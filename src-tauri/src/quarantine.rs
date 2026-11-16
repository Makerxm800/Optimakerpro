use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct QuarEntry {
    pub id: String,
    pub original_path: String,
    pub name: String,
    pub size_bytes: u64,
    pub quarantined_at: u64,
}

impl Default for QuarEntry {
    fn default() -> Self {
        QuarEntry {
            id: String::new(),
            original_path: String::new(),
            name: String::new(),
            size_bytes: 0,
            quarantined_at: 0,
        }
    }
}

pub fn quarantine_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".local/share")
        })
        .join("Optimakerpro")
        .join("quarantine")
}

fn manifest_path() -> PathBuf {
    quarantine_dir().join("manifest.json")
}

fn load_manifest() -> Vec<QuarEntry> {
    std::fs::read_to_string(manifest_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_manifest(entries: &[QuarEntry]) -> Result<(), String> {
    std::fs::create_dir_all(quarantine_dir()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    std::fs::write(manifest_path(), json).map_err(|e| e.to_string())
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[tauri::command]
pub fn quarantine_file(path: String) -> Result<QuarEntry, String> {
    let src = PathBuf::from(&path);
    let meta = std::fs::metadata(&src).map_err(|e| format!("File not found: {}", e))?;
    if !meta.is_file() {
        return Err("Only files can be quarantined".to_string());
    }
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let id = crate::runtime::fnv1a(format!("{}|{}", path, now_secs()).as_bytes()).to_string();
    let dir = quarantine_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("{}.quar", id));
    match std::fs::rename(&src, &dest) {
        Ok(()) => {}
        Err(_) => {
            // Same file may be on another drive — copy then remove.
            std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
            let _ = std::fs::remove_file(&src);
        }
    }
    let entry = QuarEntry {
        id,
        original_path: path,
        name,
        size_bytes: meta.len(),
        quarantined_at: now_secs(),
    };
    let mut entries = load_manifest();
    entries.push(entry.clone());
    save_manifest(&entries)?;
    Ok(entry)
}

#[tauri::command]
pub fn list_quarantine() -> Result<Vec<QuarEntry>, String> {
    Ok(load_manifest())
}

#[tauri::command]
pub fn restore_quarantined(id: String) -> Result<(), String> {
    let mut entries = load_manifest();
    let Some(pos) = entries.iter().position(|e| e.id == id) else {
        return Err("Entry not found".to_string());
    };
    let entry = entries.remove(pos);
    let stored = quarantine_dir().join(format!("{}.quar", id));
    let dest = PathBuf::from(&entry.original_path);
    if let Some(parent) = dest.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::rename(&stored, &dest).map_err(|e| format!("Could not restore: {}", e))?;
    save_manifest(&entries)
}

#[tauri::command]
pub fn delete_quarantined(id: String) -> Result<(), String> {
    let mut entries = load_manifest();
    let Some(pos) = entries.iter().position(|e| e.id == id) else {
        return Err("Entry not found".to_string());
    };
    entries.remove(pos);
    let stored = quarantine_dir().join(format!("{}.quar", id));
    let _ = std::fs::remove_file(&stored);
    save_manifest(&entries)
}

#[tauri::command]
pub fn reveal_quarantine() -> Result<(), String> {
    let dir = quarantine_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
