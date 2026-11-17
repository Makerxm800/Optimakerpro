use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use crate::runtime;

/// Background loop: auto cleanup, auto memory boost and game detection
/// (per-game affinity tweaks are applied the moment a game launches).
pub fn spawn(app: AppHandle) {
    runtime::apply(&crate::settings::load());
    std::thread::spawn(move || {
        let mut sys = sysinfo::System::new();
        let mut known_games: Vec<crate::game_mode::GameEntry> = Vec::new();
        let mut games_refreshed = Instant::now() - Duration::from_secs(999);
        let mut applied: HashMap<u32, String> = HashMap::new(); // pid -> game name
        let mut running: HashMap<String, u32> = HashMap::new(); // exe name -> pid

        loop {
            std::thread::sleep(Duration::from_secs(6));
            let rt = runtime::get();
            if rt.silent_mode.load(Ordering::Relaxed) {
                continue;
            }
            if rt.auto_cleanup.load(Ordering::Relaxed) {
                maybe_auto_clean(&app);
            }
            if rt.auto_memory_boost.load(Ordering::Relaxed) {
                maybe_auto_boost(&app);
            }
            watch_games(
                &app,
                &mut sys,
                &mut known_games,
                &mut games_refreshed,
                &mut applied,
                &mut running,
            );
        }
    });
}

fn watch_games(
    app: &AppHandle,
    sys: &mut sysinfo::System,
    known_games: &mut Vec<crate::game_mode::GameEntry>,
    games_refreshed: &mut Instant,
    applied: &mut HashMap<u32, String>,
    running: &mut HashMap<String, u32>,
) {
    // Re-scan installed games once a minute (registry + manifest reads).
    if games_refreshed.elapsed() >= Duration::from_secs(60) {
        *known_games = crate::game_mode::list_games().unwrap_or_default();
        *games_refreshed = Instant::now();
    }
    if known_games.is_empty() {
        return;
    }

    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);

    // Map game executables to running pids.
    let mut seen: HashMap<String, u32> = HashMap::new();
    for game in known_games.iter() {
        let target = game.exe_name.to_lowercase();
        if target.is_empty() {
            continue;
        }
        let stripped = target.trim_end_matches(".exe").to_string();
        for (pid, process) in sys.processes() {
            let name = process.name().to_string_lossy().to_lowercase();
            let exe_match = process
                .exe()
                .and_then(|e| e.file_name())
                .map(|f| f.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if (name == target || exe_match == target || name == stripped || exe_match == stripped)
                && !seen.values().any(|p| *p == pid.as_u32())
            {
                seen.insert(game.exe_name.to_lowercase(), pid.as_u32());
                break;
            }
        }
    }

    // Announce newly launched games and apply per-game tweaks.
    for game in known_games.iter() {
        let key = game.exe_name.to_lowercase();
        let Some(pid) = seen.get(&key) else {
            continue;
        };
        if running.get(&key) == Some(pid) {
            continue; // already announced
        }
        running.insert(key.clone(), *pid);
        let _ = app.emit(
            "game-detected",
            serde_json::json!({ "name": game.name, "pid": pid, "gameId": game.id }),
        );
        if game.tweaks.any_affinity() {
            if crate::game_mode::apply_affinity_pid(*pid, &game.tweaks).is_ok() {
                applied.insert(*pid, game.name.clone());
            }
        }
    }

    // Announce closed games.
    let closed: Vec<String> = running
        .iter()
        .filter(|(_, pid)| !sys.processes().keys().any(|k| k.as_u32() == **pid))
        .map(|(name, _)| name.clone())
        .collect();
    for name in closed {
        if let Some(pid) = running.remove(&name) {
            applied.remove(&pid);
            if let Some(game) = known_games
                .iter()
                .find(|g| g.exe_name.to_lowercase() == name)
            {
                let _ = app.emit(
                    "game-closed",
                    serde_json::json!({ "name": game.name, "gameId": game.id }),
                );
            }
        }
    }
}

fn maybe_auto_clean(app: &AppHandle) {
    let rt = runtime::get();
    let interval_hours = {
        let hours = rt
            .cleanup_interval_hours
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *hours
    };
    let due = {
        let mut last = rt.last_clean.lock().unwrap_or_else(|e| e.into_inner());
        match *last {
            None => {
                *last = Some(Instant::now());
                false
            }
            Some(t) => t.elapsed() >= Duration::from_secs(interval_hours as u64 * 3600),
        }
    };
    if !due {
        return;
    }
    let ids = [
        "user_temp".to_string(),
        "windows_temp".to_string(),
        "update_cache".to_string(),
        "shader_cache".to_string(),
        "crash_dumps".to_string(),
    ];
    let result = crate::cleaner::clean_items(&ids);
    {
        let mut last = rt.last_clean.lock().unwrap_or_else(|e| e.into_inner());
        *last = Some(Instant::now());
    }
    if result.freed_bytes > 0 {
        let _ = app.emit(
            "auto-cleaned",
            serde_json::json!({ "freedBytes": result.freed_bytes, "removedFiles": result.removed_files }),
        );
    }
}

fn maybe_auto_boost(app: &AppHandle) {
    let rt = runtime::get();
    let due = {
        let mut last = rt.last_boost.lock().unwrap_or_else(|e| e.into_inner());
        match *last {
            None => {
                *last = Some(Instant::now());
                false
            }
            Some(t) => t.elapsed() >= Duration::from_secs(600),
        }
    };
    if !due {
        return;
    }
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    let total = sys.total_memory();
    if total == 0 {
        return;
    }
    if (sys.used_memory() as f32 / total as f32) < 0.85 {
        return;
    }
    let result = crate::boost::boost_memory();
    {
        let mut last = rt.last_boost.lock().unwrap_or_else(|e| e.into_inner());
        *last = Some(Instant::now());
    }
    if result.freed_bytes > 0 {
        let _ = app.emit(
            "auto-boost",
            serde_json::json!({ "freedBytes": result.freed_bytes, "trimmedProcesses": result.trimmed_processes }),
        );
    }
}
