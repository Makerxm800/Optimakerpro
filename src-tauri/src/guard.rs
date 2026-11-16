use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use sysinfo::System;

use crate::runtime;

const EXE_EXTS: [&str; 15] = [
    "exe", "bat", "cmd", "scr", "com", "pif", "vbs", "js", "jse", "wsf", "hta", "jar", "msi",
    "ps1", "lnk",
];

/// Background loop: real-time temp-folder watch, auto cleanup and auto boost.
pub fn spawn(app: AppHandle) {
    runtime::apply(&crate::settings::load());
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(8));
        let rt = runtime::get();
        if rt.silent_mode.load(Ordering::Relaxed) {
            continue;
        }
        if rt.real_time_protection.load(Ordering::Relaxed) {
            scan_for_threats(&app);
        }
        if rt.auto_cleanup.load(Ordering::Relaxed) {
            maybe_auto_clean(&app);
        }
        if rt.auto_memory_boost.load(Ordering::Relaxed) {
            maybe_auto_boost(&app);
        }
    });
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn scan_for_threats(app: &AppHandle) {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(t) = std::env::var_os("TEMP") {
        dirs.push(PathBuf::from(t));
    } else {
        dirs.push(std::env::temp_dir());
    }
    #[cfg(windows)]
    {
        if let Some(win_dir) = std::env::var_os("WINDIR") {
            dirs.push(PathBuf::from(win_dir).join("Temp"));
        }
    }

    let rt = runtime::get();
    let now = SystemTime::now();
    let mut alerts: Vec<serde_json::Value> = Vec::new();

    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if !meta.is_file() {
                continue;
            }
            let path = entry.path();
            let Some(ext) = path.extension().map(|e| e.to_string_lossy().to_lowercase()) else {
                continue;
            };
            if !EXE_EXTS.contains(&ext.as_str()) {
                continue;
            }
            let age = now
                .duration_since(meta.modified().unwrap_or(now))
                .unwrap_or_default();
            if age > Duration::from_secs(1800) {
                continue;
            }
            let display = path.to_string_lossy().to_string();
            let id = runtime::fnv1a(display.as_bytes()).to_string();
            let mut seen = rt.seen_threats.lock().unwrap_or_else(|e| e.into_inner());
            if !seen.insert(id.clone()) {
                continue;
            }
            drop(seen);
            alerts.push(serde_json::json!({
                "id": id,
                "path": display,
                "name": path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default(),
                "kind": ext,
                "sizeBytes": meta.len(),
                "detectedAt": now_secs(),
            }));
        }
    }

    for alert in alerts {
        let _ = app.emit("threat-found", alert);
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
        let mut last = rt
            .last_clean
            .lock()
            .unwrap_or_else(|e| e.into_inner());
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
        let mut last = rt
            .last_clean
            .lock()
            .unwrap_or_else(|e| e.into_inner());
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
        let mut last = rt
            .last_boost
            .lock()
            .unwrap_or_else(|e| e.into_inner());
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
    let mut sys = System::new();
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
        let mut last = rt
            .last_boost
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *last = Some(Instant::now());
    }
    if result.freed_bytes > 0 {
        let _ = app.emit(
            "auto-boost",
            serde_json::json!({ "freedBytes": result.freed_bytes, "trimmedProcesses": result.trimmed_processes }),
        );
    }
}
