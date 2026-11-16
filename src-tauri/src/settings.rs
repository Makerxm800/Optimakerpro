use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub auto_memory_boost: bool,
    pub auto_cleanup: bool,
    pub silent_mode: bool,
    pub cleanup_interval_hours: u32,
    pub launch_on_startup: bool,
    pub reduce_animations: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            auto_memory_boost: true,
            auto_cleanup: true,
            silent_mode: false,
            cleanup_interval_hours: 12,
            launch_on_startup: false,
            reduce_animations: false,
        }
    }
}

pub fn settings_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".config")
    });
    base.join("optimakerpro").join("settings.json")
}

pub fn load() -> Settings {
    std::fs::read_to_string(settings_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(s: &Settings) -> Result<(), String> {
    let path = settings_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}
