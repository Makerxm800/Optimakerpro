mod boost;
mod cleaner;
mod guard;
mod quarantine;
mod runtime;
mod settings;
mod startup;
mod system_info;
mod updates;

use std::sync::Mutex;
use sysinfo::System;

pub struct SysState {
    pub system: Mutex<System>,
}

#[tauri::command]
pub fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "Optimakerpro",
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

#[tauri::command]
pub fn load_settings() -> Result<settings::Settings, String> {
    let s = settings::load();
    runtime::apply(&s);
    Ok(s)
}

#[tauri::command]
pub fn save_settings(new_settings: settings::Settings) -> Result<settings::Settings, String> {
    settings::save(&new_settings)?;
    runtime::apply(&new_settings);
    #[cfg(windows)]
    {
        startup::set_launch_on_startup(new_settings.launch_on_startup)?;
    }
    Ok(new_settings)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SysState {
            system: Mutex::new(System::new_all()),
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            load_settings,
            save_settings,
            system_info::get_system_info,
            system_info::top_processes,
            cleaner::scan_junk,
            cleaner::clean_junk,
            boost::boost_memory,
            startup::list_startup,
            startup::set_launch_on_startup,
            startup::remove_startup_item,
            quarantine::quarantine_file,
            quarantine::list_quarantine,
            quarantine::restore_quarantined,
            quarantine::delete_quarantined,
            quarantine::reveal_quarantine,
            updates::check_for_updates,
            updates::install_update,
        ])
        .setup(|app| {
            guard::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Optimakerpro");
}
