//! Game Mode: game detection, per-game CPU affinity tweaks and real
//! Windows system optimizations (registry / powercfg).
//!
//! Everything here runs without admin except tweaks marked `needs_admin`,
//! which are applied through an elevated `reg import` (one UAC prompt).

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;

#[cfg(windows)]
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE};
#[cfg(windows)]
use winreg::RegKey;

// ============================================================
// Persistence (games + per-game tweaks)
// ============================================================

#[derive(Serialize, Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct GameTweaks {
    pub disable_cpu0: bool,
    pub disable_ecores: bool,
    pub disable_smt: bool,
    pub fso_off: bool,
}

impl GameTweaks {
    pub fn any_affinity(&self) -> bool {
        self.disable_cpu0 || self.disable_ecores || self.disable_smt
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct GameEntry {
    pub id: String,
    pub name: String,
    pub exe_path: String,
    pub exe_name: String,
    pub source: String,
    pub tweaks: GameTweaks,
    #[serde(default)]
    pub running: bool,
}

impl Default for GameEntry {
    fn default() -> Self {
        GameEntry {
            id: String::new(),
            name: String::new(),
            exe_path: String::new(),
            exe_name: String::new(),
            source: "Manual".to_string(),
            tweaks: GameTweaks::default(),
            running: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
struct GamesFile {
    manual: Vec<GameEntry>,
    hidden: Vec<String>,
    tweaks: std::collections::HashMap<String, GameTweaks>,
}

fn data_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".local/share")
        })
        .join("Optimakerpro")
}

fn games_file_path() -> PathBuf {
    data_dir().join("games.json")
}

fn load_games_file() -> GamesFile {
    std::fs::read_to_string(games_file_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_games_file(file: &GamesFile) -> Result<(), String> {
    std::fs::create_dir_all(data_dir()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(games_file_path(), json).map_err(|e| e.to_string())
}

// ============================================================
// CPU topology (P-cores / E-cores / SMT)
// ============================================================

#[derive(Serialize, Clone)]
pub struct CoreTopology {
    pub cores: usize,
    pub logical: usize,
    pub e_cores: usize,
    pub smt: bool,
}

#[cfg(windows)]
mod topology {
    pub type Handle = *mut std::os::raw::c_void;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetLogicalProcessorInformationEx(
            relation: u32,
            buffer: *mut u8,
            length: *mut u32,
        ) -> i32;
        fn GetCurrentProcess() -> Handle;
        fn GetProcessAffinityMask(
            process: Handle,
            process_mask: *mut usize,
            system_mask: *mut usize,
        ) -> i32;
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
        fn CloseHandle(handle: Handle) -> i32;
        fn SetProcessAffinityMask(process: Handle, mask: usize) -> i32;
    }

    pub const RELATION_PROCESSOR_CORE: u32 = 0;
    pub const PROCESS_SET_INFORMATION: u32 = 0x0200;
    pub const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    fn le32(bytes: &[u8], off: usize) -> u32 {
        u32::from_le_bytes([bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]])
    }

    /// Per-core (affinity mask, efficiency class). efficiency_class > 0
    /// marks a performance core on hybrid (P/E) CPUs.
    pub fn core_masks() -> Vec<(usize, u8)> {
        unsafe {
            let mut len: u32 = 0;
            let _ = GetLogicalProcessorInformationEx(
                RELATION_PROCESSOR_CORE,
                std::ptr::null_mut(),
                &mut len,
            );
            if len == 0 {
                return Vec::new();
            }
            let mut buf = vec![0u8; len as usize];
            let ok = GetLogicalProcessorInformationEx(
                RELATION_PROCESSOR_CORE,
                buf.as_mut_ptr(),
                &mut len,
            );
            if ok == 0 {
                return Vec::new();
            }
            buf.truncate(len as usize);

            let mut out = Vec::new();
            let mut pos = 0usize;
            while pos + 8 <= buf.len() {
                let size = le32(&buf, pos + 4) as usize;
                if size < 40 || pos + size > buf.len() {
                    break;
                }
                // SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX:
                //   Relation(4) Size(4)
                //   PROCESSOR_RELATIONSHIP:
                //     Flags(1) EfficiencyClass(1) Reserved(20) GroupCount(2)
                //     GroupMask[0]: Mask(usize) ...
                let class = buf[pos + 8 + 1];
                let mask = usize::from_le_bytes(
                    buf[pos + 32..pos + 40].try_into().unwrap_or([0; 8]),
                );
                if mask != 0 {
                    out.push((mask, class));
                }
                pos += size;
            }
            out
        }
    }

    pub fn system_mask() -> usize {
        unsafe {
            let (mut pmask, mut smask) = (0usize, 0usize);
            if GetProcessAffinityMask(GetCurrentProcess(), &mut pmask, &mut smask) != 0 {
                smask
            } else {
                0
            }
        }
    }

    pub fn set_affinity(pid: u32, mask: usize) -> Result<(), String> {
        unsafe {
            let handle = OpenProcess(
                PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION,
                0,
                pid,
            );
            if handle.is_null() {
                return Err("Could not open the game process".to_string());
            }
            let (mut pmask, mut smask) = (0usize, 0usize);
            if GetProcessAffinityMask(handle, &mut pmask, &mut smask) == 0 {
                CloseHandle(handle);
                return Err("Could not read the process affinity".to_string());
            }
            let target = pmask & smask & mask;
            if target == 0 {
                CloseHandle(handle);
                return Err("Those cores aren't available to this process".to_string());
            }
            let ok = SetProcessAffinityMask(handle, target);
            CloseHandle(handle);
            if ok == 0 {
                Err("Windows refused to change the affinity (protected process?)".to_string())
            } else {
                Ok(())
            }
        }
    }
}

#[cfg(windows)]
fn has_perf_class(masks: &[(usize, u8)]) -> bool {
    masks.iter().any(|(_, c)| *c > 0)
}

#[cfg(windows)]
fn p_core_mask() -> usize {
    topology::core_masks()
        .iter()
        .filter(|(_, c)| *c > 0)
        .fold(0usize, |acc, (m, _)| acc | m)
}

#[cfg(windows)]
fn smt_free_mask() -> usize {
    topology::core_masks()
        .iter()
        .fold(0usize, |acc, (m, _)| {
            let lowest = m.trailing_zeros();
            if lowest < 64 {
                acc | (1usize << lowest)
            } else {
                acc
            }
        })
}

pub fn core_topology() -> CoreTopology {
    core_topology_impl()
}

#[cfg(windows)]
fn core_topology_impl() -> CoreTopology {
    let masks = topology::core_masks();
    let sys = topology::system_mask();
    let hybrid = has_perf_class(&masks);
    CoreTopology {
        cores: masks.len(),
        logical: sys.count_ones() as usize,
        e_cores: if hybrid {
            masks.iter().filter(|(_, c)| *c == 0).count()
        } else {
            0
        },
        smt: masks.iter().any(|(m, _)| m.count_ones() > 1),
    }
}

#[cfg(not(windows))]
fn core_topology_impl() -> CoreTopology {
    CoreTopology {
        cores: 0,
        logical: 0,
        e_cores: 0,
        smt: false,
    }
}

fn compute_mask(tweaks: &GameTweaks) -> Result<usize, String> {
    compute_mask_impl(tweaks)
}

#[cfg(windows)]
fn compute_mask_impl(tweaks: &GameTweaks) -> Result<usize, String> {
    let sys = topology::system_mask();
    if sys == 0 {
        return Err("Could not read CPU topology".to_string());
    }
    let hybrid = has_perf_class(&topology::core_masks());
    let mut target = sys;
    if tweaks.disable_ecores && hybrid {
        target &= p_core_mask();
    }
    if tweaks.disable_smt {
        target &= smt_free_mask();
    }
    if tweaks.disable_cpu0 {
        target &= !1usize;
    }
    if target == 0 {
        return Err("These tweaks cancel each other out — no cores left".to_string());
    }
    Ok(target)
}

#[cfg(not(windows))]
fn compute_mask_impl(_tweaks: &GameTweaks) -> Result<usize, String> {
    Err("Game tweaks are Windows-only".to_string())
}

pub fn apply_affinity_pid(pid: u32, tweaks: &GameTweaks) -> Result<(), String> {
    apply_affinity_pid_impl(pid, tweaks)
}

#[cfg(windows)]
fn apply_affinity_pid_impl(pid: u32, tweaks: &GameTweaks) -> Result<(), String> {
    let mask = compute_mask(tweaks)?;
    topology::set_affinity(pid, mask)
}

#[cfg(not(windows))]
fn apply_affinity_pid_impl(_pid: u32, _tweaks: &GameTweaks) -> Result<(), String> {
    Err("Game tweaks are Windows-only".to_string())
}

// ============================================================
// Running-process detection
// ============================================================

#[cfg(windows)]
fn running_exe_names() -> HashSet<String> {
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);
    let mut names = HashSet::new();
    for process in sys.processes().values() {
        if let Some(exe) = process.exe() {
            if let Some(n) = exe.file_name() {
                names.insert(n.to_string_lossy().to_lowercase());
            }
        }
        names.insert(process.name().to_string_lossy().to_lowercase());
    }
    names
}

#[cfg(not(windows))]
fn running_exe_names() -> HashSet<String> {
    HashSet::new()
}

fn is_running(entry: &GameEntry, running: &HashSet<String>) -> bool {
    let n = entry.exe_name.to_lowercase();
    running.contains(&n) || running.contains(&n.trim_end_matches(".exe").to_string())
}

// ============================================================
// Game detection: Steam / Epic / Riot
// ============================================================

#[cfg(windows)]
fn steam_libraries() -> Vec<PathBuf> {
    let mut libs = Vec::new();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(key) = hkcu.open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ) else {
        return libs;
    };
    let Ok(steam_path) = key.get_value::<String, _>("SteamPath") else {
        return libs;
    };
    let steam = PathBuf::from(&steam_path);
    libs.push(steam.clone());
    let vdf = steam.join("steamapps").join("libraryfolders.vdf");
    if let Ok(text) = std::fs::read_to_string(&vdf) {
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("\"path\"") {
                let raw = trimmed
                    .trim_start_matches("\"path\"")
                    .trim()
                    .trim_matches('"')
                    .replace("\\\\", "\\");
                if !raw.is_empty() {
                    libs.push(PathBuf::from(raw));
                }
            }
        }
    }
    libs
}

fn acf_value(line: &str) -> String {
    line.split('"').nth(3).unwrap_or("").to_string()
}

#[cfg(windows)]
fn detect_steam() -> Vec<GameEntry> {
    let mut games = Vec::new();
    for lib in steam_libraries() {
        let steamapps = lib.join("steamapps");
        let Ok(entries) = std::fs::read_dir(&steamapps) else {
            continue;
        };
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if !fname.starts_with("appmanifest_") || !fname.ends_with(".acf") {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            let (mut app_name, mut install_dir) = (String::new(), String::new());
            for line in text.lines() {
                let t = line.trim();
                if app_name.is_empty() && t.starts_with("\"name\"") {
                    app_name = acf_value(t);
                } else if install_dir.is_empty() && t.starts_with("\"installdir\"") {
                    install_dir = acf_value(t);
                }
            }
            if app_name.is_empty() || install_dir.is_empty() {
                continue;
            }
            let install = steamapps.join("common").join(&install_dir);
            if !install.is_dir() {
                continue;
            }
            if let Some(exe) = find_main_exe(&install) {
                games.push(make_entry(app_name, exe, "Steam"));
            }
        }
    }
    games
}

fn find_main_exe(dir: &PathBuf) -> Option<PathBuf> {
    let mut best: Option<(u64, PathBuf)> = None;
    scan_dir(dir, 0, &mut best);
    best.map(|(_, p)| p)
}

fn scan_dir(dir: &PathBuf, depth: usize, best: &mut Option<(u64, PathBuf)>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < 2 {
                scan_dir(&path, depth + 1, best);
            }
        } else {
            consider_exe(&path, best);
        }
    }
}

fn consider_exe(path: &PathBuf, best: &mut Option<(u64, PathBuf)>) {
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase());
    if ext.as_deref() != Some("exe") {
        return;
    }
    let name = path
        .file_name()
        .map(|f| f.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    const SKIP: [&str; 10] = [
        "uninstall", "crash", "redist", "dxsetup", "vcredist", "unity", "setup", "update",
        "eula", "crs",
    ];
    if SKIP.iter().any(|s| name.contains(s)) {
        return;
    }
    if let Ok(meta) = std::fs::metadata(path) {
        let size = meta.len();
        if best.as_ref().map(|(s, _)| size > *s).unwrap_or(true) {
            *best = Some((size, path.clone()));
        }
    }
}

#[cfg(windows)]
fn detect_epic() -> Vec<GameEntry> {
    let mut games = Vec::new();
    let manifests = PathBuf::from(std::env::var_os("PROGRAMDATA").unwrap_or_default())
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data")
        .join("Manifests");
    let Ok(entries) = std::fs::read_dir(&manifests) else {
        return games;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e.to_string_lossy().to_lowercase()) != Some("item") {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
            continue;
        };
        let name = v.get("DisplayName").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let install = v.get("InstallLocation").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let launch = v.get("LaunchExecutable").and_then(|s| s.as_str()).unwrap_or("").to_string();
        if name.is_empty() || install.is_empty() || launch.is_empty() {
            continue;
        }
        let exe = PathBuf::from(&install).join(&launch);
        if exe.is_file() {
            games.push(make_entry(name, exe, "Epic"));
        }
    }
    games
}

#[cfg(windows)]
fn detect_riot() -> Vec<GameEntry> {
    let mut games = Vec::new();
    let Ok(uninstall) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        KEY_READ,
    ) else {
        return games;
    };
    if let Ok(subkeys) = uninstall.enum_keys() {
        for sub in subkeys.flatten() {
            if let Ok(key) = uninstall.open_subkey_with_flags(&sub, KEY_READ) {
                let Ok(display) = key.get_value::<String, _>("DisplayName") else {
                    continue;
                };
                let lower = display.to_lowercase();
                if !(lower.contains("league of legends") || lower.contains("valorant")) {
                    continue;
                }
                if let Ok(location) = key.get_value::<String, _>("InstallLocation") {
                    let dir = PathBuf::from(&location);
                    for candidate in [
                        "VALORANT-Win64-Shipping.exe",
                        "VALORANT.exe",
                        "LeagueClient.exe",
                        "League of Legends.exe",
                    ] {
                        let exe = dir.join(candidate);
                        if exe.is_file() {
                            games.push(make_entry(display.clone(), exe, "Riot"));
                            break;
                        }
                    }
                }
            }
        }
    }
    games
}

fn make_entry(name: String, exe: PathBuf, source: &str) -> GameEntry {
    let exe_path = exe.to_string_lossy().to_string();
    let exe_name = exe
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let id = format!("{}-{:x}", source.to_lowercase(), crate::runtime::fnv1a(exe_path.as_bytes()));
    GameEntry {
        id,
        name,
        exe_path,
        exe_name,
        source: source.to_string(),
        tweaks: GameTweaks::default(),
        running: false,
    }
}

fn merge_saved_tweaks(mut entry: GameEntry, file: &GamesFile) -> GameEntry {
    if let Some(t) = file.tweaks.get(&entry.id) {
        entry.tweaks = t.clone();
    }
    entry
}

// ============================================================
// Commands
// ============================================================

#[tauri::command]
pub fn get_core_topology() -> CoreTopology {
    core_topology()
}

#[tauri::command]
pub fn list_games() -> Result<Vec<GameEntry>, String> {
    let file = load_games_file();
    let running = running_exe_names();

    #[cfg(windows)]
    let mut detected: Vec<GameEntry> = {
        let mut g = detect_steam();
        g.extend(detect_epic());
        g.extend(detect_riot());
        g
    };
    #[cfg(not(windows))]
    let mut detected: Vec<GameEntry> = Vec::new();

    let mut out: Vec<GameEntry> = Vec::new();
    let mut seen = HashSet::new();
    for g in detected.drain(..) {
        if file.hidden.contains(&g.id) || seen.contains(&g.id) {
            continue;
        }
        seen.insert(g.id.clone());
        out.push(merge_saved_tweaks(g, &file));
    }
    for m in file.manual.clone() {
        if file.hidden.contains(&m.id) || seen.contains(&m.id) {
            continue;
        }
        seen.insert(m.id.clone());
        out.push(merge_saved_tweaks(m, &file));
    }
    for g in &mut out {
        g.running = is_running(g, &running);
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
pub fn add_game_from_path(path: String) -> Result<GameEntry, String> {
    let exe = PathBuf::from(&path);
    if !exe.is_file() {
        return Err("That file doesn't exist".to_string());
    }
    if exe.extension().map(|e| e.to_string_lossy().to_lowercase()) != Some("exe") {
        return Err("Pick the game's .exe file".to_string());
    }
    let entry = make_entry(
        exe.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Game".to_string()),
        exe,
        "Manual",
    );
    let mut file = load_games_file();
    if !file.manual.iter().any(|g| g.id == entry.id) {
        file.manual.push(entry.clone());
        save_games_file(&file)?;
    }
    Ok(merge_saved_tweaks(entry, &file))
}

#[tauri::command]
pub fn remove_game(id: String) -> Result<(), String> {
    let mut file = load_games_file();
    file.manual.retain(|g| g.id != id);
    if !file.hidden.contains(&id) {
        file.hidden.push(id.clone());
    }
    file.tweaks.remove(&id);
    save_games_file(&file)
}

#[cfg(windows)]
fn set_fso(entry: &GameEntry, enable: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers",
            KEY_SET_VALUE | KEY_READ,
        )
        .map_err(|e| e.to_string())?;
    let value_name = entry.exe_path.clone();
    const TOKEN: &str = "DISABLEDXMAXIMIZEDWINDOWEDMODE";
    let existing: String = key.get_value(&value_name).unwrap_or_default();
    if enable {
        if existing.contains(TOKEN) {
            return Ok(());
        }
        let new_val = if existing.trim().is_empty() {
            format!("~ {}", TOKEN)
        } else {
            format!("{} {}", existing.trim_end(), TOKEN)
        };
        key.set_value(&value_name, &new_val).map_err(|e| e.to_string())?;
    } else if existing.contains(TOKEN) {
        let cleaned = existing
            .split_whitespace()
            .filter(|w| *w != TOKEN)
            .collect::<Vec<_>>()
            .join(" ");
        if cleaned.is_empty() || cleaned == "~" {
            let _ = key.delete_value(&value_name);
        } else {
            key.set_value(&value_name, &cleaned).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(windows)]
fn apply_single(entry: &GameEntry, tweak: &str, tweaks: &GameTweaks, enabled: bool) -> Result<(), String> {
    match tweak {
        "fso_off" => set_fso(entry, enabled),
        _ => {
            // Not running? Nothing to do live — the watcher applies the
            // tweaks automatically the next time the game launches.
            let Some(pid) = find_pid_by_exe(&entry.exe_name) else {
                return Ok(());
            };
            if tweaks.any_affinity() {
                let mask = compute_mask(tweaks)?;
                topology::set_affinity(pid, mask)
            } else {
                let sys = topology::system_mask();
                if sys == 0 {
                    return Err("Could not read CPU topology".to_string());
                }
                topology::set_affinity(pid, sys)
            }
        }
    }
}

#[cfg(not(windows))]
fn apply_single(_entry: &GameEntry, _tweak: &str, _tweaks: &GameTweaks, _enabled: bool) -> Result<(), String> {
    Err("Game tweaks are Windows-only".to_string())
}

/// Puts the game back on every core (used when the last affinity tweak is
/// disabled while the game is running).
#[cfg(windows)]
pub fn restore_affinity(entry: &GameEntry) -> Result<(), String> {
    let pid = find_pid_by_exe(&entry.exe_name).ok_or("Game isn't running right now")?;
    let sys = topology::system_mask();
    if sys == 0 {
        return Err("Could not read CPU topology".to_string());
    }
    topology::set_affinity(pid, sys)
}

#[cfg(not(windows))]
pub fn restore_affinity(_entry: &GameEntry) -> Result<(), String> {
    Err("Game tweaks are Windows-only".to_string())
}

#[cfg(windows)]
pub fn apply_affinity_for_entry(entry: &GameEntry, tweaks: &GameTweaks) -> Result<(), String> {
    if !tweaks.any_affinity() {
        return Ok(());
    }
    let mask = compute_mask(tweaks)?;
    let pid = find_pid_by_exe(&entry.exe_name).ok_or("Game isn't running right now")?;
    topology::set_affinity(pid, mask)
}

#[cfg(not(windows))]
pub fn apply_affinity_for_entry(_entry: &GameEntry, _tweaks: &GameTweaks) -> Result<(), String> {
    Err("Game tweaks are Windows-only".to_string())
}

pub fn find_pid_by_exe(exe_name: &str) -> Option<u32> {
    let target = exe_name.to_lowercase();
    let stripped = target.trim_end_matches(".exe").to_string();
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);
    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        let exe_match = process
            .exe()
            .and_then(|e| e.file_name())
            .map(|f| f.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if name == target || exe_match == target || name == stripped || exe_match == stripped {
            return Some(pid.as_u32());
        }
    }
    None
}

fn find_game_entry(game_id: &str) -> Option<GameEntry> {
    let file = load_games_file();
    #[cfg(windows)]
    {
        let mut all = {
            let mut g = detect_steam();
            g.extend(detect_epic());
            g.extend(detect_riot());
            g
        };
        all.extend(file.manual.clone());
        all.into_iter().find(|g| g.id == game_id)
    }
    #[cfg(not(windows))]
    {
        file.manual.into_iter().find(|g| g.id == game_id)
    }
}

#[tauri::command]
pub fn set_game_tweak(game_id: String, tweak: String, enabled: bool) -> Result<GameTweaks, String> {
    let mut file = load_games_file();
    let tweaks = file.tweaks.entry(game_id.clone()).or_default();
    match tweak.as_str() {
        "disable_cpu0" => tweaks.disable_cpu0 = enabled,
        "disable_ecores" => tweaks.disable_ecores = enabled,
        "disable_smt" => tweaks.disable_smt = enabled,
        "fso_off" => tweaks.fso_off = enabled,
        other => return Err(format!("Unknown tweak: {}", other)),
    }
    let saved = tweaks.clone();
    save_games_file(&file)?;

    if let Some(entry) = find_game_entry(&game_id) {
        apply_single(&entry, &tweak, &saved, enabled)?;
    }
    Ok(saved)
}

/// Apply affinity to a running game right now (Boost button).
#[tauri::command]
pub fn boost_game(game_id: String) -> Result<String, String> {
    let file = load_games_file();
    let tweaks = file.tweaks.get(&game_id).cloned().unwrap_or_default();
    let entry = find_game_entry(&game_id).ok_or("Game not found")?;
    if !tweaks.any_affinity() {
        return Err("Enable a core tweak for this game first".to_string());
    }
    apply_affinity_for_entry(&entry, &tweaks)?;
    Ok(format!("{} is now pinned to the selected cores", entry.name))
}

// ============================================================
// System tweaks catalog
// ============================================================

#[derive(Serialize, Clone)]
pub struct TweakDef {
    pub id: &'static str,
    pub category: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub detail: &'static str,
    pub badge: &'static str,
    pub needs_admin: bool,
    pub needs_restart: bool,
    pub keys: Vec<&'static str>,
}

#[derive(Serialize, Clone)]
pub struct TweakState {
    pub id: String,
    pub active: bool,
    pub error: Option<String>,
}

pub fn catalog() -> Vec<TweakDef> {
    vec![
        TweakDef {
            id: "windows_game_mode",
            category: "fps",
            title: "Windows Game Mode",
            description: "Lets Windows prioritise the game you're playing and pause background work.",
            detail: "Sets HKCU\\Software\\Microsoft\\GameBar → AutoGameModeEnabled=1 and AllowAutoGameMode=1. Windows then gives the foreground game priority for CPU and memory. Turning it off sets AutoGameModeEnabled=0.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["HKCU\\Software\\Microsoft\\GameBar"],
        },
        TweakDef {
            id: "game_dvr_off",
            category: "fps",
            title: "Disable Game DVR recording",
            description: "Stops Windows from silently recording gameplay in the background.",
            detail: "Sets HKCU\\System\\GameConfigStore → GameDVR_Enabled=0 and HKCU\\...\\GameDVR → AppCaptureEnabled=0. The background clip recorder (Win+G) stops consuming GPU time. Deactivating re-enables it.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["HKCU\\System\\GameConfigStore", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR"],
        },
        TweakDef {
            id: "power_plan_high",
            category: "fps",
            title: "High performance power plan",
            description: "Switches Windows to the High Performance plan so the CPU doesn't idle down mid-game.",
            detail: "Runs powercfg /setactive for the High Performance scheme (8c5e7fda-…). Applies instantly, no restart. Deactivating switches back to the Balanced plan.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["powercfg /getactivescheme"],
        },
        TweakDef {
            id: "mouse_precision_off",
            category: "fps",
            title: "Disable mouse acceleration",
            description: "Turns off 'Enhance pointer precision' for 1:1 mouse movements — essential for aim.",
            detail: "Sets HKCU\\Control Panel\\Mouse → MouseSpeed=0, MouseThreshold1=0, MouseThreshold2=0. Applies at your next sign-in. Deactivating restores the Windows defaults (1 / 6 / 6).",
            badge: "safe",
            needs_admin: false,
            needs_restart: true,
            keys: vec!["HKCU\\Control Panel\\Mouse"],
        },
        TweakDef {
            id: "gpu_scheduling",
            category: "fps",
            title: "Hardware-accelerated GPU scheduling",
            description: "Hands GPU scheduling to a dedicated processor for lower latency (restart required).",
            detail: "Sets HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers → HwSchMode=2. Needs administrator approval (UAC) and a full restart. Older GPUs/drivers ignore it.",
            badge: "advanced",
            needs_admin: true,
            needs_restart: true,
            keys: vec!["HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"],
        },
        TweakDef {
            id: "network_throttling",
            category: "network",
            title: "Disable network throttling",
            description: "Stops Windows from capping network traffic while multimedia plays.",
            detail: "Sets HKLM\\…\\Multimedia\\SystemProfile → NetworkThrottlingIndex=0xFFFFFFFF. Windows normally limits network throughput to 10 packets per millisecond while media plays — this removes that cap. Needs admin + restart.",
            badge: "advanced",
            needs_admin: true,
            needs_restart: true,
            keys: vec!["HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"],
        },
        TweakDef {
            id: "system_responsiveness",
            category: "network",
            title: "System responsiveness for games",
            description: "Reserves fewer CPU cycles for background tasks (20% → 10%).",
            detail: "Sets HKLM\\…\\Multimedia\\SystemProfile → SystemResponsiveness=10. Windows reserves CPU for background services; halving it gives games more headroom. Needs admin + restart. Deactivating restores the default 20.",
            badge: "advanced",
            needs_admin: true,
            needs_restart: true,
            keys: vec!["HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"],
        },
        TweakDef {
            id: "games_priority",
            category: "network",
            title: "Games task priority",
            description: "Raises CPU/GPU priority and I/O bandwidth for the 'Games' scheduling class.",
            detail: "Sets HKLM\\…\\Multimedia\\SystemProfile\\Tasks\\Games → Priority=6, Scheduling Category=High, SFIO Priority=High. Needs admin + restart. Deactivating restores Priority=2, Medium, Normal.",
            badge: "advanced",
            needs_admin: true,
            needs_restart: true,
            keys: vec!["HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games"],
        },
        TweakDef {
            id: "nagle_off",
            category: "network",
            title: "Disable Nagle's algorithm",
            description: "Sends small packets immediately instead of batching — can shave ping in some games.",
            detail: "Sets TcpAckFrequency=1 and TCPNoDelay=1 on every network interface (HKLM\\SYSTEM\\…\\Tcpip\\Parameters\\Interfaces). Effect varies by game; most noticeable in older titles. Needs admin + restart.",
            badge: "advanced",
            needs_admin: true,
            needs_restart: true,
            keys: vec!["HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces"],
        },
        TweakDef {
            id: "animations_off",
            category: "qol",
            title: "Reduce window animations",
            description: "Disables minimise/restore animations and shortens menu delays.",
            detail: "Sets HKCU\\Control Panel\\Desktop\\WindowMetrics → MinAnimate=0 and HKCU\\Control Panel\\Desktop → MenuShowDelay=0. Makes the desktop feel snappier and frees a little GPU time. Applies at next sign-in.",
            badge: "safe",
            needs_admin: false,
            needs_restart: true,
            keys: vec!["HKCU\\Control Panel\\Desktop\\WindowMetrics", "HKCU\\Control Panel\\Desktop"],
        },
        TweakDef {
            id: "startup_delay_off",
            category: "qol",
            title: "Remove startup app delay",
            description: "Removes Windows' staged delay when launching startup apps after sign-in.",
            detail: "Sets HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize → StartupDelayInMSec=0. Your startup apps launch immediately instead of one-by-one. Applies on next boot.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize"],
        },
        TweakDef {
            id: "background_apps_off",
            category: "qol",
            title: "Disable background apps",
            description: "Stops store apps from running in the background when you're not using them.",
            detail: "Sets HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications → GlobalUserDisabled=1. Fewer background processes means more CPU and RAM for games. Applies at next sign-in.",
            badge: "safe",
            needs_admin: false,
            needs_restart: true,
            keys: vec!["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications"],
        },
        TweakDef {
            id: "advertising_id_off",
            category: "privacy",
            title: "Disable advertising ID",
            description: "Stops Windows from generating an ad-tracking ID for apps.",
            detail: "Sets HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo → Enabled=0. No performance impact — just less tracking. Instant, no restart.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo"],
        },
        TweakDef {
            id: "input_personalization_off",
            category: "privacy",
            title: "Disable typing personalisation",
            description: "Stops Windows collecting your typing and inking history in the background.",
            detail: "Sets HKCU\\InputPersonalization → RestrictImplicitTextCollection=1 and RestrictImplicitInkCollection=1. Slightly less background chatter. Instant, no restart.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["HKCU\\InputPersonalization"],
        },
        TweakDef {
            id: "tailored_experiences_off",
            category: "privacy",
            title: "Disable tailored experiences",
            description: "Stops Windows using diagnostic data to personalise tips and ads.",
            detail: "Sets HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy → TailoredExperiencesWithDiagnosticDataEnabled=0. Instant, no restart.",
            badge: "safe",
            needs_admin: false,
            needs_restart: false,
            keys: vec!["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy"],
        },
        TweakDef {
            id: "diagnostic_data_off",
            category: "privacy",
            title: "Diagnostic data to minimum",
            description: "Sets the diagnostic data policy to the lowest level Windows allows.",
            detail: "Sets HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection → AllowTelemetry=0 (policy). Needs administrator approval (UAC). Deactivating removes the policy.",
            badge: "advanced",
            needs_admin: true,
            needs_restart: false,
            keys: vec!["HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection"],
        },
    ]
}

#[tauri::command]
pub fn get_tweak_catalog() -> Vec<TweakDef> {
    catalog()
}

#[tauri::command]
pub fn get_tweak_states() -> Vec<TweakState> {
    catalog()
        .iter()
        .map(|d| TweakState {
            id: d.id.to_string(),
            active: tweak_active(d.id),
            error: None,
        })
        .collect()
}

// ------------------------------------------------------------
// Registry helpers
// ------------------------------------------------------------

#[cfg(windows)]
fn set_u32_direct(path: &str, value: &str, data: u32) -> Result<(), String> {
    let hk = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hk
        .create_subkey_with_flags(path, KEY_SET_VALUE)
        .map_err(|e| e.to_string())?;
    key.set_value(value, &data).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn set_string_direct(path: &str, value: &str, data: &str) -> Result<(), String> {
    let hk = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hk
        .create_subkey_with_flags(path, KEY_SET_VALUE)
        .map_err(|e| e.to_string())?;
    key.set_value(value, &data).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn delete_value_direct(path: &str, value: &str) -> Result<(), String> {
    let hk = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hk.open_subkey_with_flags(path, KEY_SET_VALUE) {
        let _ = key.delete_value(value);
    }
    Ok(())
}

#[cfg(windows)]
fn run_powercfg(args: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new("powercfg.exe")
        .raw_arg(args)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

// ------------------------------------------------------------
// Elevated (UAC) application via reg import of a .reg file
// ------------------------------------------------------------

#[cfg(windows)]
#[derive(Default)]
struct RegScript {
    lines: Vec<String>,
}

#[cfg(windows)]
fn reg_section(path: &str) -> String {
    let (hive, rest) = path.split_once('\\').unwrap_or((path, ""));
    let hive = match hive {
        "HKLM" => "HKEY_LOCAL_MACHINE",
        _ => "HKEY_CURRENT_USER",
    };
    format!("[{}\\{}]", hive, rest)
}

#[cfg(windows)]
impl RegScript {
    fn add_dword(&mut self, path: &str, value: &str, data: u32) {
        self.lines
            .push(format!("{}\n\"{}\"=dword:{:08x}", reg_section(path), value, data));
    }
    fn add_string(&mut self, path: &str, value: &str, data: &str) {
        self.lines
            .push(format!("{}\n\"{}\"=\"{}\"", reg_section(path), value, data));
    }
    fn delete(&mut self, path: &str, value: &str) {
        self.lines
            .push(format!("{}\n\"{}\"=-", reg_section(path), value));
    }
    fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }
}

#[cfg(windows)]
fn import_elevated(script: &RegScript) -> Result<(), String> {
    use std::io::Write;

    let content = format!(
        "Windows Registry Editor Version 5.00\n\n{}",
        script.lines.join("\n\n")
    );
    let mut path = std::env::temp_dir();
    path.push("optimakerpro-tweaks.reg");

    {
        let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
        f.write_all(&[0xFF, 0xFE])?; // UTF-16 LE BOM — required by reg import
        for unit in content.encode_utf16() {
            f.write_all(&unit.to_le_bytes())?;
        }
    }

    let ps_command = format!(
        "Start-Process reg -ArgumentList 'import \"{}\"' -Verb RunAs -Wait",
        path.display()
    );
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_command])
        .status()
        .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    if !status.success() {
        return Err("Windows declined the elevation request".to_string());
    }
    Ok(())
}

// ------------------------------------------------------------
// Per-tweak apply / revert / status
// ------------------------------------------------------------

#[cfg(windows)]
fn apply_one(id: &str, enable: bool, script: &mut RegScript) -> Result<(), String> {
    match id {
        "windows_game_mode" => {
            if enable {
                set_u32_direct(r"Software\Microsoft\GameBar", "AutoGameModeEnabled", 1)?;
                set_u32_direct(r"Software\Microsoft\GameBar", "AllowAutoGameMode", 1)?;
            } else {
                set_u32_direct(r"Software\Microsoft\GameBar", "AutoGameModeEnabled", 0)?;
            }
        }
        "game_dvr_off" => {
            if enable {
                set_u32_direct(r"System\GameConfigStore", "GameDVR_Enabled", 0)?;
                set_u32_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\GameDVR",
                    "AppCaptureEnabled",
                    0,
                )?;
            } else {
                set_u32_direct(r"System\GameConfigStore", "GameDVR_Enabled", 1)?;
                delete_value_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\GameDVR",
                    "AppCaptureEnabled",
                )?;
            }
        }
        "power_plan_high" => {
            if enable {
                run_powercfg("/setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c")?;
            } else {
                run_powercfg("/setactive 381b4222-f694-41f0-9685-ff5bb260df2e")?;
            }
        }
        "mouse_precision_off" => {
            let (speed, t1, t2) = if enable { ("0", "0", "0") } else { ("1", "6", "6") };
            set_string_direct(r"Control Panel\Mouse", "MouseSpeed", speed)?;
            set_string_direct(r"Control Panel\Mouse", "MouseThreshold1", t1)?;
            set_string_direct(r"Control Panel\Mouse", "MouseThreshold2", t2)?;
        }
        "gpu_scheduling" => {
            if enable {
                script.add_dword(r"HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "HwSchMode", 2);
            } else {
                script.delete(r"HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "HwSchMode");
            }
        }
        "network_throttling" => {
            if enable {
                script.add_dword(
                    r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                    "NetworkThrottlingIndex",
                    0xffffffff,
                );
            } else {
                script.delete(
                    r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                    "NetworkThrottlingIndex",
                );
            }
        }
        "system_responsiveness" => {
            if enable {
                script.add_dword(
                    r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                    "SystemResponsiveness",
                    10,
                );
            } else {
                script.delete(
                    r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                    "SystemResponsiveness",
                );
            }
        }
        "games_priority" => {
            let path = r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games";
            if enable {
                script.add_dword(path, "Priority", 6);
                script.add_dword(path, "GPU Priority", 8);
                script.add_string(path, "Scheduling Category", "High");
                script.add_string(path, "SFIO Priority", "High");
            } else {
                script.add_dword(path, "Priority", 2);
                script.add_string(path, "Scheduling Category", "Medium");
                script.add_string(path, "SFIO Priority", "Normal");
            }
        }
        "nagle_off" => {
            let interfaces = RegKey::predef(HKEY_LOCAL_MACHINE)
                .open_subkey_with_flags(
                    r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces",
                    KEY_READ,
                )
                .map_err(|e| e.to_string())?;
            if let Ok(subkeys) = interfaces.enum_keys() {
                for sub in subkeys.flatten() {
                    let full = format!(
                        r"HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\{}",
                        sub
                    );
                    if enable {
                        script.add_dword(&full, "TcpAckFrequency", 1);
                        script.add_dword(&full, "TCPNoDelay", 1);
                    } else {
                        script.delete(&full, "TcpAckFrequency");
                        script.delete(&full, "TCPNoDelay");
                    }
                }
            }
        }
        "animations_off" => {
            if enable {
                set_string_direct(r"Control Panel\Desktop\WindowMetrics", "MinAnimate", "0")?;
                set_string_direct(r"Control Panel\Desktop", "MenuShowDelay", "0")?;
            } else {
                set_string_direct(r"Control Panel\Desktop\WindowMetrics", "MinAnimate", "1")?;
                set_string_direct(r"Control Panel\Desktop", "MenuShowDelay", "400")?;
            }
        }
        "startup_delay_off" => {
            if enable {
                set_u32_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize",
                    "StartupDelayInMSec",
                    0,
                )?;
            } else {
                delete_value_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize",
                    "StartupDelayInMSec",
                )?;
            }
        }
        "background_apps_off" => {
            if enable {
                set_u32_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
                    "GlobalUserDisabled",
                    1,
                )?;
            } else {
                delete_value_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
                    "GlobalUserDisabled",
                )?;
            }
        }
        "advertising_id_off" => {
            if enable {
                set_u32_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
                    "Enabled",
                    0,
                )?;
            } else {
                delete_value_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
                    "Enabled",
                )?;
            }
        }
        "input_personalization_off" => {
            if enable {
                set_u32_direct("InputPersonalization", "RestrictImplicitTextCollection", 1)?;
                set_u32_direct("InputPersonalization", "RestrictImplicitInkCollection", 1)?;
            } else {
                delete_value_direct("InputPersonalization", "RestrictImplicitTextCollection")?;
                delete_value_direct("InputPersonalization", "RestrictImplicitInkCollection")?;
            }
        }
        "tailored_experiences_off" => {
            if enable {
                set_u32_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\Privacy",
                    "TailoredExperiencesWithDiagnosticDataEnabled",
                    0,
                )?;
            } else {
                delete_value_direct(
                    r"Software\Microsoft\Windows\CurrentVersion\Privacy",
                    "TailoredExperiencesWithDiagnosticDataEnabled",
                )?;
            }
        }
        "diagnostic_data_off" => {
            if enable {
                script.add_dword(
                    r"HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection",
                    "AllowTelemetry",
                    0,
                );
            } else {
                script.delete(
                    r"HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection",
                    "AllowTelemetry",
                );
            }
        }
        other => return Err(format!("Unknown tweak: {}", other)),
    }
    Ok(())
}

#[cfg(windows)]
fn read_u32_hkcu(path: &str, value: &str) -> Option<u32> {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(path, KEY_READ)
        .ok()?
        .get_value::<u32, _>(value)
        .ok()
}

#[cfg(windows)]
fn read_string_hkcu(path: &str, value: &str) -> Option<String> {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(path, KEY_READ)
        .ok()?
        .get_value::<String, _>(value)
        .ok()
}

#[cfg(windows)]
fn read_u32_hklm(path: &str, value: &str) -> Option<u32> {
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(path, KEY_READ)
        .ok()?
        .get_value::<u32, _>(value)
        .ok()
}

#[cfg(windows)]
fn read_string_hklm(path: &str, value: &str) -> Option<String> {
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(path, KEY_READ)
        .ok()?
        .get_value::<String, _>(value)
        .ok()
}

#[cfg(windows)]
fn active_power_scheme_is_high() -> bool {
    if let Ok(out) = run_powercfg("/getactivescheme") {
        out.to_lowercase()
            .contains("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c")
    } else {
        false
    }
}

#[cfg(windows)]
fn tweak_active(id: &str) -> bool {
    match id {
        "windows_game_mode" => read_u32_hkcu(r"Software\Microsoft\GameBar", "AutoGameModeEnabled")
            .map(|v| v != 0)
            .unwrap_or(true),
        "game_dvr_off" => {
            read_u32_hkcu(r"System\GameConfigStore", "GameDVR_Enabled") == Some(0)
                && read_u32_hkcu(
                    r"Software\Microsoft\Windows\CurrentVersion\GameDVR",
                    "AppCaptureEnabled",
                )
                .map(|v| v == 0)
                .unwrap_or(true)
        }
        "power_plan_high" => active_power_scheme_is_high(),
        "mouse_precision_off" => {
            read_string_hkcu(r"Control Panel\Mouse", "MouseSpeed").map(|v| v == "0").unwrap_or(false)
        }
        "gpu_scheduling" => {
            read_u32_hklm(r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "HwSchMode") == Some(2)
        }
        "network_throttling" => {
            read_u32_hklm(
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                "NetworkThrottlingIndex",
            ) == Some(0xffffffff)
        }
        "system_responsiveness" => {
            read_u32_hklm(
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
                "SystemResponsiveness",
            ) == Some(10)
        }
        "games_priority" => {
            let path = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games";
            read_u32_hklm(path, "Priority") == Some(6)
                && read_string_hklm(path, "Scheduling Category")
                    .map(|v| v.eq_ignore_ascii_case("high"))
                    .unwrap_or(false)
        }
        "nagle_off" => {
            if let Ok(interfaces) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
                r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces",
                KEY_READ,
            ) {
                if let Ok(subkeys) = interfaces.enum_keys() {
                    for sub in subkeys.flatten() {
                        if let Ok(key) = interfaces.open_subkey_with_flags(&sub, KEY_READ) {
                            if let Ok(v) = key.get_value::<u32, _>("TCPNoDelay") {
                                if v == 1 {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
            false
        }
        "animations_off" => {
            read_string_hkcu(r"Control Panel\Desktop\WindowMetrics", "MinAnimate")
                .map(|v| v == "0")
                .unwrap_or(false)
        }
        "startup_delay_off" => {
            read_u32_hkcu(
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize",
                "StartupDelayInMSec",
            ) == Some(0)
        }
        "background_apps_off" => {
            read_u32_hkcu(
                r"Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
                "GlobalUserDisabled",
            ) == Some(1)
        }
        "advertising_id_off" => {
            read_u32_hkcu(
                r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
                "Enabled",
            )
            .map(|v| v == 0)
            .unwrap_or(false)
        }
        "input_personalization_off" => {
            read_u32_hkcu("InputPersonalization", "RestrictImplicitTextCollection") == Some(1)
        }
        "tailored_experiences_off" => {
            read_u32_hkcu(
                r"Software\Microsoft\Windows\CurrentVersion\Privacy",
                "TailoredExperiencesWithDiagnosticDataEnabled",
            )
            .map(|v| v == 0)
            .unwrap_or(false)
        }
        "diagnostic_data_off" => {
            read_u32_hklm(
                r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
                "AllowTelemetry",
            ) == Some(0)
        }
        _ => false,
    }
}

#[cfg(not(windows))]
fn tweak_active(_id: &str) -> bool {
    false
}

/// Apply or revert a batch of tweaks. Admin tweaks go through ONE elevated
/// reg import (single UAC prompt); non-admin ones are written directly.
#[tauri::command]
pub fn set_tweaks(ids: Vec<String>, enabled: bool) -> Result<Vec<TweakState>, String> {
    set_tweaks_impl(ids, enabled)
}

#[cfg(windows)]
fn set_tweaks_impl(ids: Vec<String>, enabled: bool) -> Result<Vec<TweakState>, String> {
    let defs = catalog();
    let mut script = RegScript::default();

    for id in &ids {
        let Some(def) = defs.iter().find(|d| d.id == *id) else {
            continue;
        };
        if def.needs_admin {
            apply_one(id, enabled, &mut script)?;
        } else {
            let mut scratch = RegScript::default();
            apply_one(id, enabled, &mut scratch)?;
        }
    }

    if !script.is_empty() {
        import_elevated(&script)?;
    }

    // Verify (give UAC/reg a moment to finish).
    let mut states = Vec::new();
    for id in &ids {
        if !defs.iter().any(|d| d.id == *id) {
            continue;
        }
        let mut active = tweak_active(id);
        if active != enabled {
            for _ in 0..6 {
                std::thread::sleep(std::time::Duration::from_millis(400));
                active = tweak_active(id);
                if active == enabled {
                    break;
                }
            }
        }
        states.push(TweakState {
            id: id.clone(),
            active,
            error: if active != enabled {
                Some(
                    "Windows didn't apply it — UAC was declined or the value is managed by policy"
                        .to_string(),
                )
            } else {
                None
            },
        });
    }
    Ok(states)
}

#[cfg(not(windows))]
fn set_tweaks_impl(_ids: Vec<String>, _enabled: bool) -> Result<Vec<TweakState>, String> {
    Err("System tweaks are Windows-only".to_string())
}

/// Mode presets: balanced = conservative, performance = safe tweaks on
/// (advanced ones stay opt-in), custom = whatever the user toggled.
#[tauri::command]
pub fn set_game_mode(mode: String) -> Result<Vec<TweakState>, String> {
    let ids: Vec<String> = match mode.as_str() {
        "balanced" => vec!["windows_game_mode".into(), "game_dvr_off".into()],
        "performance" => vec![
            "windows_game_mode".into(),
            "game_dvr_off".into(),
            "power_plan_high".into(),
            "startup_delay_off".into(),
            "background_apps_off".into(),
        ],
        "custom" => Vec::new(),
        other => return Err(format!("Unknown mode: {}", other)),
    };
    set_game_mode_impl(ids)
}

#[cfg(windows)]
fn set_game_mode_impl(ids: Vec<String>) -> Result<Vec<TweakState>, String> {
    if ids.is_empty() {
        return Ok(catalog()
            .iter()
            .map(|d| TweakState {
                id: d.id.to_string(),
                active: tweak_active(d.id),
                error: None,
            })
            .collect());
    }
    // Turn off safe tweaks that the preset doesn't include.
    let safe_off: Vec<String> = catalog()
        .iter()
        .filter(|d| !d.needs_admin && !ids.contains(&d.id.to_string()))
        .filter(|d| tweak_active(d.id))
        .map(|d| d.id.to_string())
        .collect();
    if !safe_off.is_empty() {
        let _ = set_tweaks(safe_off, false);
    }
    set_tweaks(ids, true)
}

#[cfg(not(windows))]
fn set_game_mode_impl(_ids: Vec<String>) -> Result<Vec<TweakState>, String> {
    Err("Game Mode presets are Windows-only".to_string())
}
