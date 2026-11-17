use serde::Serialize;
use sysinfo::{Disks, System};
use tauri::State;

use crate::SysState;

#[tauri::command]
pub fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "Optimakerpro",
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

#[derive(Serialize, Clone)]
pub struct DiskInfo {
    pub mount: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct SystemSnapshot {
    pub os_name: String,
    pub os_version: String,
    pub arch: String,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_usage: f32,
    pub mem_total_bytes: u64,
    pub mem_used_bytes: u64,
    pub process_count: usize,
    pub uptime_secs: u64,
    pub disks: Vec<DiskInfo>,
}

fn snapshot(sys: &mut System) -> SystemSnapshot {
    sys.refresh_all();
    let disks: Vec<DiskInfo> = Disks::new_with_refreshed_list()
        .list()
        .iter()
        .map(|d| DiskInfo {
            mount: d.mount_point().to_string_lossy().to_string(),
            total_bytes: d.total_space(),
            free_bytes: d.available_space(),
        })
        .filter(|d| d.total_bytes > 0)
        .collect();
    SystemSnapshot {
        os_name: System::name().unwrap_or_else(|| "Unknown OS".to_string()),
        os_version: System::os_version().unwrap_or_default(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_name: sys
            .cpus()
            .first()
            .map(|c| c.brand().trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| format!("{} cores", sys.cpus().len())),
        cpu_cores: sys.cpus().len(),
        cpu_usage: sys.global_cpu_usage(),
        mem_total_bytes: sys.total_memory(),
        mem_used_bytes: sys.used_memory(),
        process_count: sys.processes().len(),
        uptime_secs: System::uptime(),
        disks,
    }
}

#[tauri::command]
pub fn get_system_info(state: State<'_, SysState>) -> Result<SystemSnapshot, String> {
    let mut sys = state
        .system
        .lock()
        .map_err(|_| "System state unavailable".to_string())?;
    Ok(snapshot(&mut sys))
}

#[derive(Serialize, Clone)]
pub struct ProcInfo {
    pub name: String,
    pub memory_bytes: u64,
}

#[tauri::command]
pub fn top_processes(
    state: State<'_, SysState>,
    limit: Option<usize>,
) -> Result<Vec<ProcInfo>, String> {
    let mut sys = state
        .system
        .lock()
        .map_err(|_| "System state unavailable".to_string())?;
    sys.refresh_all();
    let limit = limit.unwrap_or(8).min(20);
    let mut list: Vec<ProcInfo> = sys
        .processes()
        .values()
        .map(|p| ProcInfo {
            name: p.name().to_string_lossy().to_string(),
            memory_bytes: p.memory(),
        })
        .collect();
    list.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
    list.truncate(limit);
    Ok(list)
}
