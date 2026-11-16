//! Startup-app management.
//!
//! Windows: reads/writes the standard `Run`/`RunOnce` registry keys.
//! macOS: scans `~/Library/LaunchAgents` for installer plists and
//! enables/disables them by moving the file to a `disabled` folder.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupApp {
    pub name: String,
    pub path: String,
    pub command: String,
    pub enabled: bool,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct StartupToggleResult {
    pub name: String,
    pub enabled: bool,
    pub ok: bool,
    pub message: String,
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::collections::BTreeMap;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_ALL_ACCESS, KEY_READ};
    use winreg::RegKey;

    const RUN_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const RUN_ONCE_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\RunOnce";

    fn read_keys(hk: RegKey, hklm: RegKey) -> Vec<StartupApp> {
        let mut apps = BTreeMap::new();

        for (hive, label) in [(hk, "HKCU"), (hklm, "HKLM")] {
            for (sub_path, enabled) in [
                (RUN_PATH, true),
                (RUN_ONCE_PATH, false),
            ] {
                let Ok(key) = hive.open_subkey_with_flags(sub_path, KEY_READ) else {
                    continue;
                };
                for entry in key.enum_values() {
                    match entry {
                        Ok((name, value)) => {
                            let value = value.to_string();
                            let source = format!(
                                "{label}\\{}",
                                &sub_path[sub_path.rfind('\\').map(|p| p + 1).unwrap_or(0)..]
                            );
                            apps.entry(format!("{source}\\{name}")).or_insert_with(|| {
                                StartupApp {
                                    name: name.clone(),
                                    path: name.clone(),
                                    command: value,
                                    enabled,
                                    source: source.clone(),
                                }
                            });
                        }
                        Err(_) => break,
                    }
                }
            }
        }
        apps.into_values().collect()
    }

    pub fn list() -> Vec<StartupApp> {
        read_keys(RegKey::predef(HKEY_CURRENT_USER), RegKey::predef(HKEY_LOCAL_MACHINE))
    }

    pub fn set_enabled(name: &str, path: &str, enabled: bool) -> StartupToggleResult {
        // HKCU Run is preferred for writes; HKLM Run is checked for removals.
        for (hive, label) in [
            (RegKey::predef(HKEY_CURRENT_USER), "HKCU"),
            (RegKey::predef(HKEY_LOCAL_MACHINE), "HKLM"),
        ] {
            let Ok(key) = hive.open_subkey_with_flags(RUN_PATH, KEY_ALL_ACCESS) else {
                continue;
            };

            if enabled {
                if key.set_value(name, path.as_str()).is_ok() {
                    return StartupToggleResult {
                        name: name.to_string(),
                        enabled: true,
                        ok: true,
                        message: format!("{label} startup entry enabled."),
                    };
                }
            } else if key.delete_value(name).is_ok() {
                return StartupToggleResult {
                    name: name.to_string(),
                    enabled: false,
                    ok: true,
                    message: format!("{label} startup entry disabled."),
                };
            }
        }

        StartupToggleResult {
            name: name.to_string(),
            enabled,
            ok: false,
            message: "Startup entry not found in Run keys.".to_string(),
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn launch_agents_dir() -> Option<PathBuf> {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/LaunchAgents"))
    }

    fn disabled_dir() -> Option<PathBuf> {
        launch_agents_dir().map(|d| d.join("disabled"))
    }

    fn extract_label(content: &str, file: &str) -> String {
        if let Some(start) = content.find("<key>Label</key>") {
            let after = &content[start + "<key>Label</key>".len()..];
            if let Some(s) = after.find("<string>") {
                let rest = &after[s + "<string>".len()..];
                if let Some(e) = rest.find("</string>") {
                    return rest[..e].trim().to_string();
                }
            }
        }
        file.to_string()
    }

    fn extract_command(content: &str) -> String {
        if let Some(start) = content.find("<key>ProgramArguments</key>") {
            let after = &content[start + "<key>ProgramArguments</key>".len()..];
            if let Some(s) = after.find("<string>") {
                let rest = &after[s + "<string>".len()..];
                if let Some(e) = rest.find("</string>") {
                    return rest[..e].trim().to_string();
                }
            }
        }
        "".to_string()
    }

    pub fn list() -> Vec<StartupApp> {
        let Some(dir) = launch_agents_dir() else {
            return Vec::new();
        };
        let Ok(entries) = fs::read_dir(&dir) else {
            return Vec::new();
        };

        let mut apps = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("plist") {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let disabled = disabled_dir().unwrap_or_default();
            let is_disabled = path.starts_with(&disabled);
            let label = extract_label(&content, entry.file_name().to_string_lossy().as_ref());
            let command = extract_command(&content);
            apps.push(StartupApp {
                name: label,
                path: path.to_string_lossy().to_string(),
                command,
                enabled: !is_disabled,
                source: "LaunchAgents".to_string(),
            });
        }
        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        apps
    }

    pub fn set_enabled(name: &str, path: &str, enabled: bool) -> StartupToggleResult {
        let Some(dir) = launch_agents_dir() else {
            return StartupToggleResult {
                name: name.to_string(),
                enabled,
                ok: false,
                message: "Could not resolve the LaunchAgents directory.".to_string(),
            };
        };
        let plist = PathBuf::from(path);

        if enabled {
            if plist.exists() && plist.starts_with(&dir) {
                return StartupToggleResult {
                    name: name.to_string(),
                    enabled: true,
                    ok: true,
                    message: "Startup item is already enabled.".to_string(),
                };
            }
            if let Some(disabled) = disabled_dir() {
                let candidate = disabled.join(plist.file_name().unwrap_or_default());
                if candidate.exists() {
                    let _ = fs::create_dir_all(&dir);
                    if fs::rename(&candidate, &plist).is_ok() {
                        return StartupToggleResult {
                            name: name.to_string(),
                            enabled: true,
                            ok: true,
                            message: "Startup item enabled.".to_string(),
                        };
                    }
                }
            }
            return StartupToggleResult {
                name: name.to_string(),
                enabled,
                ok: false,
                message: "No disabled copy found to restore.".to_string(),
            };
        }

        if !plist.exists() {
            return StartupToggleResult {
                name: name.to_string(),
                enabled: false,
                ok: true,
                message: "Startup item was already disabled.".to_string(),
            };
        }

        let Some(disabled) = disabled_dir() else {
            return StartupToggleResult {
                name: name.to_string(),
                enabled: false,
                ok: false,
                message: "Could not resolve the disabled directory.".to_string(),
            };
        };
        let _ = fs::create_dir_all(&disabled);
        let target = disabled.join(plist.file_name().unwrap_or_default());
        match fs::rename(&plist, &target) {
            Ok(_) => StartupToggleResult {
                name: name.to_string(),
                enabled: false,
                ok: true,
                message: "Startup item disabled (moved to disabled folder).".to_string(),
            },
            Err(e) => StartupToggleResult {
                name: name.to_string(),
                enabled: false,
                ok: false,
                message: format!("Failed to disable: {e}"),
            },
        }
    }
}

#[tauri::command]
pub fn list_startup_apps() -> Vec<StartupApp> {
    imp::list()
}

#[tauri::command]
pub fn set_startup_app_state(
    name: String,
    path: String,
    enabled: bool,
) -> StartupToggleResult {
    imp::set_enabled(&name, &path, enabled)
}
