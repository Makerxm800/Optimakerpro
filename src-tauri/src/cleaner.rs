use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// A file must be at least this old before it is counted or deleted.
const MIN_AGE: Duration = Duration::from_secs(3600);

#[derive(Serialize, Clone)]
pub struct CleanItem {
    pub id: String,
    pub label: String,
    pub description: String,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Serialize)]
pub struct CleanResult {
    pub freed_bytes: u64,
    pub removed_files: u64,
    pub skipped: u64,
}

struct ItemDef {
    id: &'static str,
    label: &'static str,
    description: &'static str,
    paths: Vec<PathBuf>,
    /// Filename patterns (lowercase, `*` wildcards). Empty = every file.
    patterns: Vec<String>,
}

fn user_temp() -> PathBuf {
    std::env::var_os("TEMP")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

fn item_defs() -> Vec<ItemDef> {
    let mut defs: Vec<ItemDef> = Vec::new();

    defs.push(ItemDef {
        id: "user_temp",
        label: "Temporary files",
        description: "Leftovers from apps and installers in your user temp folder",
        paths: vec![user_temp()],
        patterns: vec![],
    });

    let mut dump_paths: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    {
        if let Some(win_dir) = std::env::var_os("WINDIR") {
            let w = PathBuf::from(win_dir);
            defs.push(ItemDef {
                id: "windows_temp",
                label: "Windows temp",
                description: "System temp files that are safe to remove",
                paths: vec![w.join("Temp")],
                patterns: vec![],
            });
            defs.push(ItemDef {
                id: "update_cache",
                label: "Windows Update leftovers",
                description: "Old downloaded update packages",
                paths: vec![w.join("SoftwareDistribution").join("Download")],
                patterns: vec![],
            });
            dump_paths.push(w.join("Minidump"));
        }
    }

    if let Some(local) = dirs::data_local_dir() {
        dump_paths.push(local.join("CrashDumps"));

        defs.push(ItemDef {
            id: "shader_cache",
            label: "Shader cache",
            description: "Compiled GPU shader cache that rebuilds itself as needed",
            paths: vec![local.join("D3DSCache")],
            patterns: vec![],
        });

        defs.push(ItemDef {
            id: "thumbnails",
            label: "Thumbnail cache",
            description: "Cached image previews for File Explorer",
            paths: vec![local.join("Microsoft").join("Windows").join("Explorer")],
            patterns: vec!["thumbcache_*.db".to_string()],
        });

        let mut browser_paths: Vec<PathBuf> = Vec::new();
        for root in [
            local.join("Google").join("Chrome").join("User Data"),
            local.join("Microsoft").join("Edge").join("User Data"),
        ] {
            if let Ok(entries) = std::fs::read_dir(&root) {
                for profile in entries.flatten() {
                    if !profile.path().is_dir() {
                        continue;
                    }
                    for cache in ["Cache", "Code Cache", "GPUCache"] {
                        let p = profile.path().join(cache);
                        if p.is_dir() {
                            browser_paths.push(p);
                        }
                    }
                }
            }
        }
        if let Ok(entries) = std::fs::read_dir(local.join("Mozilla").join("Firefox").join("Profiles"))
        {
            for profile in entries.flatten() {
                let p = profile.path().join("cache2");
                if p.is_dir() {
                    browser_paths.push(p);
                }
            }
        }
        if !browser_paths.is_empty() {
            defs.push(ItemDef {
                id: "browser_cache",
                label: "Browser caches",
                description: "Cached pages and images from Chrome, Edge and Firefox",
                paths: browser_paths,
                patterns: vec![],
            });
        }
    }

    #[cfg(not(windows))]
    {
        let cache = dirs::cache_dir().unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".cache")
        });
        defs.push(ItemDef {
            id: "user_cache",
            label: "User cache",
            description: "Cached files in your user cache folder",
            paths: vec![cache],
            patterns: vec![],
        });
    }

    if !dump_paths.is_empty() {
        defs.push(ItemDef {
            id: "crash_dumps",
            label: "Crash dumps",
            description: "Dumps collected when apps or Windows crashed",
            paths: dump_paths,
            patterns: vec![],
        });
    }

    defs
}

fn is_old_enough(meta: &std::fs::Metadata) -> bool {
    let modified = meta.modified().unwrap_or(SystemTime::now());
    SystemTime::now()
        .duration_since(modified)
        .unwrap_or_default()
        >= MIN_AGE
}

fn wildcard_match(s: &str, p: &str) -> bool {
    if p.is_empty() {
        return s.is_empty();
    }
    let pc = p.chars().next().unwrap();
    if pc == '*' {
        let rest = &p[pc.len_utf8()..];
        for i in 0..=s.chars().count() {
            let sub: String = s.chars().skip(i).collect();
            if wildcard_match(&sub, rest) {
                return true;
            }
        }
        false
    } else {
        s.starts_with(pc) && wildcard_match(&s[pc.len_utf8()..], &p[pc.len_utf8()..])
    }
}

fn matches_patterns(path: &Path, patterns: &[String]) -> bool {
    if patterns.is_empty() {
        return true;
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    patterns.iter().any(|p| wildcard_match(&name, p))
}

fn measure_path(path: &Path, patterns: &[String], size: &mut u64, count: &mut u64) {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        return;
    };
    if meta.is_file() {
        if is_old_enough(&meta) && matches_patterns(path, patterns) {
            *size += meta.len();
            *count += 1;
        }
    } else if meta.is_dir() {
        let Ok(entries) = std::fs::read_dir(path) else {
            return;
        };
        for entry in entries.flatten() {
            measure_path(&entry.path(), patterns, size, count);
        }
    }
}

fn purge_path(path: &Path, patterns: &[String], freed: &mut u64, removed: &mut u64, skipped: &mut u64) {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        *skipped += 1;
        return;
    };
    if meta.is_file() {
        if is_old_enough(&meta) && matches_patterns(path, patterns) {
            let size = meta.len();
            match std::fs::remove_file(path) {
                Ok(()) => {
                    *freed += size;
                    *removed += 1;
                }
                Err(_) => *skipped += 1,
            }
        }
    } else if meta.is_dir() {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                purge_path(&entry.path(), patterns, freed, removed, skipped);
            }
        }
        // Remove the directory itself if it is now empty (fails silently otherwise).
        let _ = std::fs::remove_dir(path);
    }
}

pub fn scan_items() -> Vec<CleanItem> {
    item_defs()
        .into_iter()
        .map(|def| {
            let (mut size, mut count) = (0u64, 0u64);
            for p in &def.paths {
                measure_path(p, &def.patterns, &mut size, &mut count);
            }
            CleanItem {
                id: def.id.to_string(),
                label: def.label.to_string(),
                description: def.description.to_string(),
                size_bytes: size,
                file_count: count,
            }
        })
        .collect()
}

pub fn clean_items(ids: &[String]) -> CleanResult {
    let defs = item_defs();
    let mut result = CleanResult {
        freed_bytes: 0,
        removed_files: 0,
        skipped: 0,
    };
    for id in ids {
        if let Some(def) = defs.iter().find(|d| d.id == id) {
            let (mut freed, mut removed, mut skipped) = (0u64, 0u64, 0u64);
            for p in &def.paths {
                purge_path(p, &def.patterns, &mut freed, &mut removed, &mut skipped);
            }
            result.freed_bytes += freed;
            result.removed_files += removed;
            result.skipped += skipped;
        }
    }
    result
}

#[tauri::command]
pub fn scan_junk() -> Result<Vec<CleanItem>, String> {
    Ok(scan_items())
}

#[tauri::command]
pub fn clean_junk(app: tauri::AppHandle, ids: Vec<String>) -> Result<CleanResult, String> {
    use tauri::Emitter;
    let total = ids.len();
    let mut result = CleanResult {
        freed_bytes: 0,
        removed_files: 0,
        skipped: 0,
    };
    for (index, id) in ids.iter().enumerate() {
        let _ = app.emit(
            "clean-progress",
            serde_json::json!({ "index": index + 1, "total": total, "id": id }),
        );
        let r = clean_items(std::slice::from_ref(id));
        result.freed_bytes += r.freed_bytes;
        result.removed_files += r.removed_files;
        result.skipped += r.skipped;
    }
    Ok(result)
}
