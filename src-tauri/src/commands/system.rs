//! Real system telemetry via the `sysinfo` crate (cross-platform).

use serde::Serialize;
use sysinfo::{Disks, System};

#[derive(Debug, Serialize)]
pub struct SystemStats {
    pub os: String,
    pub os_version: String,
    pub architecture: String,
    pub cpu_model: String,
    pub cpu_percent: f64,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub memory_percent: f64,
    pub swap_used_bytes: u64,
    pub swap_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_percent: f64,
    pub uptime_seconds: u64,
    pub boot_time_seconds: u64,
}

#[tauri::command]
pub fn get_system_stats() -> SystemStats {
    let mut sys = System::new();
    sys.refresh_all();

    let cpu_percent = sys
        .global_cpu_info()
        .as_ref()
        .map(|c| c.usage())
        .unwrap_or(0.0);

    let mem_total = sys.total_memory();
    let mem_used = sys.used_memory();
    let mem_percent = if mem_total > 0 {
        (mem_used as f64 / mem_total as f64) * 100.0
    } else {
        0.0
    };

    let swap_total = sys.total_swap();
    let swap_used = sys.used_swap();

    // Pick the primary system disk: root on macOS/Linux, the first
    // non-removable disk on Windows.
    let disks = Disks::new_with_refreshed_list();
    let disk = disks
        .iter()
        .find(|d| d.mount_point() == "/")
        .or_else(|| {
            disks
                .iter()
                .find(|d| !d.name().to_string_lossy().contains("Removable"))
        })
        .or_else(|| disks.iter().next());

    let (disk_used, disk_total) = match disk {
        Some(d) => (d.used_space(), d.total_space()),
        None => (0, 0),
    };
    let disk_percent = if disk_total > 0 {
        (disk_used as f64 / disk_total as f64) * 100.0
    } else {
        0.0
    };

    let cpu_model = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    SystemStats {
        os: sys.os_name().unwrap_or("Unknown").to_string(),
        os_version: sys.os_version().unwrap_or("").to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        cpu_model,
        cpu_percent: (cpu_percent * 100.0).round() / 100.0,
        memory_used_bytes: mem_used,
        memory_total_bytes: mem_total,
        memory_percent: (mem_percent * 100.0).round() / 100.0,
        swap_used_bytes: swap_used,
        swap_total_bytes: swap_total,
        disk_used_bytes: disk_used,
        disk_total_bytes: disk_total,
        disk_percent: (disk_percent * 100.0).round() / 100.0,
        uptime_seconds: sys.uptime(),
        boot_time_seconds: sys.boot_time(),
    }
}
