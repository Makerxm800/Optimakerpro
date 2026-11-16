use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

pub struct Runtime {
    pub auto_memory_boost: AtomicBool,
    pub auto_cleanup: AtomicBool,
    pub silent_mode: AtomicBool,
    pub cleanup_interval_hours: Mutex<u32>,
    pub last_boost: Mutex<Option<Instant>>,
    pub last_clean: Mutex<Option<Instant>>,
}

static RUNTIME: OnceLock<Runtime> = OnceLock::new();

pub fn get() -> &'static Runtime {
    RUNTIME.get_or_init(|| Runtime {
        auto_memory_boost: AtomicBool::new(true),
        auto_cleanup: AtomicBool::new(true),
        silent_mode: AtomicBool::new(false),
        cleanup_interval_hours: Mutex::new(12),
        last_boost: Mutex::new(None),
        last_clean: Mutex::new(None),
    })
}

pub fn apply(s: &crate::settings::Settings) {
    let rt = get();
    rt.auto_memory_boost
        .store(s.auto_memory_boost, Ordering::Relaxed);
    rt.auto_cleanup.store(s.auto_cleanup, Ordering::Relaxed);
    rt.silent_mode.store(s.silent_mode, Ordering::Relaxed);
    if let Ok(mut hours) = rt.cleanup_interval_hours.lock() {
        *hours = s.cleanup_interval_hours.max(1);
    }
}

pub fn fnv1a(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in bytes {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
