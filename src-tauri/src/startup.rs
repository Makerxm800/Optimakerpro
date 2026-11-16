use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct StartupItem {
    pub location: String,
    pub name: String,
    pub command: String,
}

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_VALUE: &str = "Optimakerpro";

#[tauri::command]
pub fn list_startup() -> Result<Vec<StartupItem>, String> {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;

        let mut items = Vec::new();
        for (label, hive) in [("HKCU", HKEY_CURRENT_USER), ("HKLM", HKEY_LOCAL_MACHINE)] {
            let key = match RegKey::predef(hive).open_subkey_with_flags(RUN_KEY, KEY_READ) {
                Ok(k) => k,
                Err(_) => continue,
            };
            if let Ok(values) = key.enum_values() {
                for value in values.flatten() {
                    let (name, data) = value;
                    let command = match data {
                        winreg::RegValue::Sz(s) => s,
                        winreg::RegValue::ExpandSz(s) => s,
                        winreg::RegValue::Binary(b) => String::from_utf8_lossy(&b).to_string(),
                        other => format!("{:?}", other),
                    };
                    items.push(StartupItem {
                        location: label.to_string(),
                        name,
                        command,
                    });
                }
            }
        }
        items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(items)
    }

    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn set_launch_on_startup(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE};
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu
            .open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE | KEY_QUERY_VALUE)
            .map_err(|e| e.to_string())?;
        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            key.set_value(APP_VALUE, &format!("\"{}\"", exe.display()))
                .map_err(|e| e.to_string())?;
        } else {
            let _ = key.delete_value(APP_VALUE);
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = enabled;
        Ok(())
    }
}

#[tauri::command]
pub fn remove_startup_item(location: String, name: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_SET_VALUE};
        use winreg::RegKey;

        let hive = if location == "HKLM" {
            HKEY_LOCAL_MACHINE
        } else {
            HKEY_CURRENT_USER
        };
        let key = RegKey::predef(hive)
            .open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
            .map_err(|e| e.to_string())?;
        key.delete_value(&name).map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = (location, name);
        Ok(())
    }
}
