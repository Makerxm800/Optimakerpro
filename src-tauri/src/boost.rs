use serde::Serialize;

#[derive(Serialize)]
pub struct BoostResult {
    pub trimmed_processes: u32,
    pub freed_bytes: u64,
    pub message: String,
}

#[tauri::command]
pub fn boost_memory() -> BoostResult {
    boost_memory_impl()
}

/// Trims the working set of memory-heavy processes, which pushes reclaimable
/// pages back to the standby list — the same thing classic "memory boosters" do.
#[cfg(windows)]
fn boost_memory_impl() -> BoostResult {
    #[allow(non_snake_case)]
    mod win {
        pub type Handle = *mut std::os::raw::c_void;

        #[repr(C)]
        #[derive(Clone, Copy)]
        pub struct ProcessMemoryCounters {
            pub cb: u32,
            pub page_fault_count: u32,
            pub peak_working_set_size: usize,
            pub working_set_size: usize,
            pub quota_peak_paged_pool_usage: usize,
            pub quota_paged_pool_usage: usize,
            pub quota_peak_non_paged_pool_usage: usize,
            pub quota_non_paged_pool_usage: usize,
            pub pagefile_usage: usize,
            pub peak_pagefile_usage: usize,
        }

        #[link(name = "kernel32")]
        extern "system" {
            fn OpenProcess(desired_access: u32, inherit: i32, pid: u32) -> Handle;
            fn CloseHandle(handle: Handle) -> i32;
        }

        #[link(name = "psapi")]
        extern "system" {
            fn EmptyWorkingSet(handle: Handle) -> i32;
            fn GetProcessMemoryInfo(
                handle: Handle,
                counters: *mut ProcessMemoryCounters,
                cb: u32,
            ) -> i32;
        }

        pub const PROCESS_SET_QUOTA: u32 = 0x0100;
        pub const PROCESS_QUERY_INFORMATION: u32 = 0x0400;
        pub const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

        fn empty_counters() -> ProcessMemoryCounters {
            ProcessMemoryCounters {
                cb: std::mem::size_of::<ProcessMemoryCounters>() as u32,
                page_fault_count: 0,
                peak_working_set_size: 0,
                working_set_size: 0,
                quota_peak_paged_pool_usage: 0,
                quota_paged_pool_usage: 0,
                quota_peak_non_paged_pool_usage: 0,
                quota_non_paged_pool_usage: 0,
                pagefile_usage: 0,
                peak_pagefile_usage: 0,
            }
        }

        /// Returns the number of bytes trimmed off this process's working set.
        pub fn trim_process(pid: u32) -> Option<i64> {
            unsafe {
                let mut handle =
                    OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, 0, pid);
                if handle.is_null() {
                    handle = OpenProcess(
                        PROCESS_SET_QUOTA | PROCESS_QUERY_LIMITED_INFORMATION,
                        0,
                        pid,
                    );
                }
                if handle.is_null() {
                    return None;
                }
                let mut before = empty_counters();
                let mut after = empty_counters();
                let ok_before = GetProcessMemoryInfo(handle, &mut before, before.cb) != 0;
                let emptied = EmptyWorkingSet(handle) != 0;
                let ok_after = GetProcessMemoryInfo(handle, &mut after, after.cb) != 0;
                CloseHandle(handle);
                if !emptied {
                    return None;
                }
                if ok_before && ok_after {
                    Some(
                        (before.working_set_size as i64 - after.working_set_size as i64).max(0),
                    )
                } else {
                    Some(0)
                }
            }
        }
    }

    let sys = sysinfo::System::new_all();
    let myself = std::process::id();
    let mut trimmed = 0u32;
    let mut freed_total = 0i64;
    for (pid, process) in sys.processes() {
        if process.memory() < 15_000_000 {
            continue;
        }
        if pid.as_u32() == myself {
            continue;
        }
        if let Some(freed) = win::trim_process(pid.as_u32()) {
            trimmed += 1;
            freed_total += freed;
        }
    }
    BoostResult {
        trimmed_processes: trimmed,
        freed_bytes: freed_total.max(0) as u64,
        message: format!("Trimmed the working sets of {} running processes", trimmed),
    }
}

#[cfg(not(windows))]
fn boost_memory_impl() -> BoostResult {
    BoostResult {
        trimmed_processes: 0,
        freed_bytes: 0,
        message: "Memory boost is a Windows feature — everything else works here too."
            .to_string(),
    }
}
