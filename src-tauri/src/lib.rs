mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_stats,
            commands::cleanup::get_junk_report,
            commands::cleanup::clean_junk,
            commands::startup::list_startup_apps,
            commands::startup::set_startup_app_state,
            commands::optimizer::boost_memory,
            commands::optimizer::set_schedule,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Taurie V2");
}
