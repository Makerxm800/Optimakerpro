/**
 * Bridge between the UI and the Tauri backend.
 *
 * When running inside the Tauri desktop app, commands are invoked over IPC and
 * return real system data. When running in a plain browser (preview / web),
 * a realistic simulation keeps the whole app fully interactive.
 */

export interface SystemStats {
  os: string;
  os_version: string;
  architecture: string;
  cpu_model: string;
  cpu_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  memory_percent: number;
  swap_used_bytes: number;
  swap_total_bytes: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  disk_percent: number;
  uptime_seconds: number;
  boot_time_seconds: number;
}

export interface JunkItem {
  id: string;
  name: string;
  description: string;
  path: string;
  size_bytes: number;
  safe: boolean;
}

export interface JunkReport {
  total_bytes: number;
  item_count: number;
  scanned_roots: string[];
  items: JunkItem[];
}

export interface CleanupResult {
  removed_bytes: number;
  removed_files: number;
  errors: string[];
}

export interface StartupApp {
  name: string;
  path: string;
  command: string;
  enabled: boolean;
  source: string;
}

export interface StartupToggleResult {
  name: string;
  enabled: boolean;
  ok: boolean;
  message: string;
}

export interface BoostResult {
  freed_bytes: number;
  method: string;
  message: string;
}

export interface ScheduleResult {
  ok: boolean;
  message: string;
}

const isTauri =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  throw new Error("browser-fallback");
}

/* ------------------------------------------------------------------ *
 * Mock environment (browser preview)                                  *
 * ------------------------------------------------------------------ */

const ONE_MB = 1024 * 1024;

let mockStats: SystemStats = {
  os: "Windows 11 Pro",
  os_version: "23H2",
  architecture: "x86_64",
  cpu_model: "Intel Core i7-12700K",
  cpu_percent: 21.4,
  memory_used_bytes: 10.6 * ONE_MB * 1024,
  memory_total_bytes: 32 * ONE_MB * 1024,
  memory_percent: 33.1,
  swap_used_bytes: 2.1 * ONE_MB * 1024,
  swap_total_bytes: 8 * ONE_MB * 1024,
  disk_used_bytes: 512 * 1024 * ONE_MB,
  disk_total_bytes: 1024 * 1024 * ONE_MB,
  disk_percent: 50.0,
  uptime_seconds: 4 * 3600 + 12 * 60,
  boot_time_seconds: 0,
};

function randomWalk(value: number, min: number, max: number, step: number) {
  const next = value + (Math.random() - 0.5) * step;
  return Math.min(max, Math.max(min, next));
}

/** Simulates live-moving telemetry while the dashboard is open. */
export function startTelemetryTicker(onUpdate: (s: SystemStats) => void) {
  if (isTauri) return () => undefined;
  const timer = setInterval(() => {
    mockStats = {
      ...mockStats,
      cpu_percent: randomWalk(mockStats.cpu_percent, 3, 92, 8),
      memory_percent: randomWalk(mockStats.memory_percent, 20, 88, 4),
      memory_used_bytes:
        (mockStats.memory_total_bytes / 100) * mockStats.memory_percent,
      swap_used_bytes:
        (mockStats.swap_total_bytes / 100) *
        (mockStats.swap_used_bytes / mockStats.swap_total_bytes) *
        100,
    };
    onUpdate(mockStats);
  }, 3000);
  return () => clearInterval(timer);
}

const mockJunk: JunkReport = {
  total_bytes: 0,
  item_count: 0,
  scanned_roots: [],
  items: [
    {
      id: "junk-0",
      name: "Temporary Files",
      description: "Files left behind by applications and Windows itself.",
      path: "C:\\Users\\user\\AppData\\Local\\Temp",
      size_bytes: 1.72 * 1024 * ONE_MB,
      safe: true,
    },
    {
      id: "junk-1",
      name: "Windows Temp",
      description: "Temporary files owned by Windows system services.",
      path: "C:\\Windows\\Temp",
      size_bytes: 640 * ONE_MB,
      safe: true,
    },
    {
      id: "junk-2",
      name: "Browser Cache",
      description: "Cached web assets — automatically rebuilt on demand.",
      path: "C:\\Users\\user\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache",
      size_bytes: 512 * ONE_MB,
      safe: true,
    },
    {
      id: "junk-3",
      name: "Crash Reports & Logs",
      description: "Old diagnostic dumps and app crash logs.",
      path: "C:\\Users\\user\\AppData\\Local\\CrashDumps",
      size_bytes: 288 * ONE_MB,
      safe: true,
    },
    {
      id: "junk-4",
      name: "Recycle Bin",
      description: "Files already deleted — safe to permanently remove.",
      path: "$Recycle.Bin",
      size_bytes: 156 * ONE_MB,
      safe: true,
    },
  ],
};
mockJunk.total_bytes = mockJunk.items.reduce((s, i) => s + i.size_bytes, 0);
mockJunk.item_count = mockJunk.items.length;

const mockStartup: StartupApp[] = [
  {
    name: "Google Chrome",
    path: "chrome",
    command: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --start-minimized',
    enabled: true,
    source: "HKCU\\Run",
  },
  {
    name: "Slack",
    path: "slack",
    command: '"C:\\Users\\user\\AppData\\Local\\Slack\\app-4.36.0\\Slack.exe"',
    enabled: true,
    source: "HKCU\\Run",
  },
  {
    name: "Spotify",
    path: "spotify",
    command: '"C:\\Users\\user\\AppData\\Roaming\\Spotify\\Spotify.exe"',
    enabled: true,
    source: "HKCU\\Run",
  },
  {
    name: "Microsoft Edge",
    path: "msedge",
    command: '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --hidden',
    enabled: false,
    source: "HKLM\\Run",
  },
  {
    name: "Discord",
    path: "discord",
    command: '"C:\\Users\\user\\AppData\\Local\\Discord\\app-1.0.9003\\Discord.exe"',
    enabled: true,
    source: "HKCU\\Run",
  },
  {
    name: "OneDrive",
    path: "onedrive",
    command: '"C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe" /background',
    enabled: false,
    source: "HKLM\\Run",
  },
];

/* ------------------------------------------------------------------ *
 * Public API — real IPC when available, simulation otherwise.          *
 * ------------------------------------------------------------------ */

export async function getSystemStats(): Promise<SystemStats> {
  try {
    return await invoke<SystemStats>("get_system_stats");
  } catch {
    return mockStats;
  }
}

export async function getJunkReport(): Promise<JunkReport> {
  try {
    return await invoke<JunkReport>("get_junk_report");
  } catch {
    return mockJunk;
  }
}

export async function cleanJunk(ids: string[]): Promise<CleanupResult> {
  try {
    return await invoke<CleanupResult>("clean_junk", { itemIds: ids });
  } catch {
    const removed = mockJunk.items
      .filter((i) => ids.includes(i.id))
      .reduce((s, i) => s + i.size_bytes, 0);
    return {
      removed_bytes: removed,
      removed_files: ids.length,
      errors: [],
    };
  }
}

export async function listStartupApps(): Promise<StartupApp[]> {
  try {
    return await invoke<StartupApp[]>("list_startup_apps");
  } catch {
    return mockStartup;
  }
}

export async function setStartupAppState(
  name: string,
  path: string,
  enabled: boolean
): Promise<StartupToggleResult> {
  try {
    return await invoke<StartupToggleResult>("set_startup_app_state", {
      name,
      path,
      enabled,
    });
  } catch {
    return {
      name,
      enabled,
      ok: true,
      message: `${enabled ? "Enabled" : "Disabled"} ${name} at startup (preview mode).`,
    };
  }
}

export async function boostMemory(): Promise<BoostResult> {
  try {
    return await invoke<BoostResult>("boost_memory");
  } catch {
    const freed = Math.round(1.6 * ONE_MB * 1024) + Math.floor(Math.random() * 512 * ONE_MB);
    return {
      freed_bytes: freed,
      method: "simulated",
      message: `Reclaimed ~${(freed / (ONE_MB * 1024)).toFixed(2)} GB of standby memory.`,
    };
  }
}

export async function setSchedule(
  enabled: boolean,
  frequency: string
): Promise<ScheduleResult> {
  try {
    return await invoke<ScheduleResult>("set_schedule", { enabled, frequency });
  } catch {
    return {
      ok: true,
      message: enabled
        ? `Maintenance will now run ${frequency} (preview mode).`
        : "Maintenance schedule removed.",
    };
  }
}
