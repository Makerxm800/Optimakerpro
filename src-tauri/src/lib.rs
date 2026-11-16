mod boost;
mod cleaner;
mod game_mode;
mod guard;
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

// Commands are defined inside their own modules (settings::, system_info::).
// Defining #[tauri::command] functions directly in the crate root makes the
// macro-generated helper macros collide in the root macro namespace (E0255).

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(SysState {
            system: Mutex::new(System::new_all()),
        })
        .invoke_handler(tauri::generate_handler![
            system_info::get_app_info,
            settings::load_settings,
            settings::save_settings,
            system_info::get_system_info,
            system_info::top_processes,
            cleaner::scan_junk,
            cleaner::clean_junk,
            boost::boost_memory,
            startup::list_startup,
            startup::set_launch_on_startup,
            startup::remove_startup_item,
            game_mode::get_core_topology,
            game_mode::list_games,
            game_mode::add_game_from_path,
            game_mode::remove_game,
            game_mode::set_game_tweak,
            game_mode::boost_game,
            game_mode::get_tweak_catalog,
            game_mode::get_tweak_states,
            game_mode::set_tweaks,
            game_mode::set_game_mode,
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
