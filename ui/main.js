/* ============================================================
   Optimakerpro — frontend logic
   Talks to the Rust backend through Tauri IPC.
   Falls back to demo data when opened outside Tauri (preview mode).
   ============================================================ */

"use strict";

const T = window.__TAURI__;
const isTauri = !!T;
const invoke = isTauri ? T.core.invoke : demoInvoke;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  settings: null,
  snapshot: null,
  junk: null,
  page: "dashboard",
  update: { available: false, version: null, checking: false },
  activity: [],
  history: loadJSON("opm-history", { cleans: [], boosts: [] }),
  // Game mode
  games: [],
  catalog: [],
  tweakStates: {}, // id -> { active, error }
  topology: null,
  mode: "balanced",
  gameCat: "all",
  runningGame: null,
};

/* ============================================================
   Helpers
   ============================================================ */

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function fmtGB(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hueFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

function animateBar(barEl, to, duration = 600) {
  return new Promise((resolve) => {
    barEl.style.transition = `width ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    requestAnimationFrame(() => {
      barEl.style.width = `${to}%`;
    });
    setTimeout(resolve, duration);
  });
}

function animateNumber(el, from, to, duration = 700) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ============================================================
   Toasts
   ============================================================ */

const TOAST_LIMIT = 3;
const activeToasts = new Map();

function toast(title, { body = "", kind = "", actions = [], sticky = false, dedupe = true } = {}) {
  const wrap = $("#toasts");
  const key = `${kind}|${title}|${body}`;

  // Identical toast already on screen → bump its counter, never stack a copy.
  if (dedupe && !actions.length && activeToasts.has(key)) {
    const rec = activeToasts.get(key);
    rec.count += 1;
    const badge = rec.el.querySelector(".toast-count");
    if (badge) {
      badge.textContent = `×${rec.count}`;
      badge.classList.add("show");
      badge.classList.remove("bump");
      void badge.offsetWidth;
      badge.classList.add("bump");
    }
    rec.restart();
    return rec.dismiss;
  }

  // Keep the stack short: retire the oldest toast when at capacity.
  if (wrap.children.length >= TOAST_LIMIT) {
    const oldest = activeToasts.values().next().value;
    if (oldest) oldest.dismiss(true);
  }

  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `
    <div class="toast-top">
      <strong>${esc(title)}</strong>
      <span class="toast-count"></span>
      <span class="toast-x" title="Dismiss" role="button" aria-label="Dismiss">✕</span>
    </div>
    ${body ? `<p>${esc(body)}</p>` : ""}
    ${actions.length ? `<div class="toast-actions"></div>` : ""}
  `;
  const actionRow = el.querySelector(".toast-actions");
  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = `btn ${a.primary ? "btn-primary" : ""}`;
    btn.textContent = a.label;
    btn.addEventListener("click", () => {
      dismiss(true);
      a.cb && a.cb();
    });
    actionRow.appendChild(btn);
  });
  wrap.appendChild(el);

  const rec = { el, count: 1, timer: null, dismiss, restart: null };

  function startTimer(ms) {
    if (rec.timer) clearTimeout(rec.timer);
    if (sticky || actions.length) return;
    rec.timer = setTimeout(() => dismiss(), ms);
  }
  rec.restart = () => startTimer(4500);

  function dismiss(instant = false) {
    if (!activeToasts.has(key)) return;
    activeToasts.delete(key);
    if (rec.timer) clearTimeout(rec.timer);
    if (instant) {
      el.remove();
    } else {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 250);
    }
  }

  el.querySelector(".toast-x").addEventListener("click", () => dismiss());
  // Hovering a toast pauses the auto-hide so it can be read in peace.
  el.addEventListener("mouseenter", () => {
    if (rec.timer) clearTimeout(rec.timer);
    rec.timer = null;
  });
  el.addEventListener("mouseleave", () => rec.restart());

  startTimer(kind === "err" ? 8000 : 4500);
  activeToasts.set(key, rec);
  return dismiss;
}

/* One summary toast for a whole batch of tweak results — never N toasts. */
function summarizeTweakResults(states, enabling, fallbackTitle = "") {
  if (!states || !states.length) return;
  const failed = states.filter((s) => s.error);
  const ok = states.filter((s) => !s.error);

  if (!failed.length && ok.length === 1) {
    const def = state.catalog.find((d) => d.id === ok[0].id);
    const t = (def && def.title) || fallbackTitle || "Tweak";
    if (enabling) {
      if (def && def.needs_restart) {
        toast("Restart required", { kind: "good", body: `${t} applied — restart your PC to fully apply it.` });
      } else {
        toast("Applied", { kind: "good", body: `${t} is active and verified on your system.` });
      }
    } else {
      toast("Reverted", { body: `${t} is back to Windows defaults.` });
    }
    return;
  }

  if (!failed.length) {
    const restarts = ok.filter((s) => {
      const d = state.catalog.find((c) => c.id === s.id);
      return d && d.needs_restart;
    }).length;
    if (enabling && restarts) {
      toast("Applied — restart needed", {
        kind: "good",
        body: `${ok.length} optimizations active — ${restarts} need${restarts === 1 ? "s" : ""} a PC restart to fully take effect.`,
      });
    } else {
      toast(enabling ? "Applied" : "Reverted", {
        kind: "good",
        body: `${ok.length} optimization${ok.length === 1 ? "" : "s"} ${enabling ? "active and verified." : "back to Windows defaults."}`,
      });
    }
    return;
  }

  toast("Some tweaks didn't apply", {
    kind: "err",
    body: `${failed.length} of ${states.length} failed — ${failed[0].error}`,
  });
}

/* ============================================================
   Modal
   ============================================================ */

function openModal(html) {
  const overlay = $("#modalOverlay");
  const box = $("#modalBox");
  box.innerHTML = `<button class="modal-close" aria-label="Close">✕</button>${html}`;
  overlay.classList.remove("hidden");
  box.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
  document.addEventListener("keydown", escClose);
  return box;
}

function closeModal() {
  $("#modalOverlay").classList.add("hidden");
  $("#modalBox").innerHTML = "";
  document.removeEventListener("keydown", escClose);
}

function escClose(e) {
  if (e.key === "Escape") closeModal();
}

/* ============================================================
   Demo mode (when opened in a plain browser, outside Tauri)
   ============================================================ */

const demoSettings = {
  autoMemoryBoost: true,
  autoCleanup: true,
  silentMode: false,
  cleanupIntervalHours: 12,
  launchOnStartup: false,
  reduceAnimations: false,
};

const demoCatalog = [
  { id: "windows_game_mode", category: "fps", title: "Windows Game Mode", description: "Lets Windows prioritise the game you're playing and pause background work.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["HKCU\\Software\\Microsoft\\GameBar"], detail: "Sets AutoGameModeEnabled=1 and AllowAutoGameMode=1 so the foreground game gets CPU and memory priority." },
  { id: "game_dvr_off", category: "fps", title: "Disable Game DVR recording", description: "Stops Windows from silently recording gameplay in the background.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["HKCU\\System\\GameConfigStore", "HKCU\\...\\GameDVR"], detail: "The background clip recorder (Win+G) stops consuming GPU time." },
  { id: "power_plan_high", category: "fps", title: "High performance power plan", description: "Switches Windows to the High Performance plan so the CPU doesn't idle down mid-game.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["powercfg /getactivescheme"], detail: "Applies instantly — no restart needed. Deactivating switches back to Balanced." },
  { id: "mouse_precision_off", category: "fps", title: "Disable mouse acceleration", description: "Turns off 'Enhance pointer precision' for 1:1 mouse movements — essential for aim.", badge: "safe", needs_admin: false, needs_restart: true, keys: ["HKCU\\Control Panel\\Mouse"], detail: "Applies at your next sign-in." },
  { id: "gpu_scheduling", category: "fps", title: "Hardware-accelerated GPU scheduling", description: "Hands GPU scheduling to a dedicated processor for lower latency (restart required).", badge: "advanced", needs_admin: true, needs_restart: true, keys: ["HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"], detail: "Needs administrator approval (UAC) and a full restart." },
  { id: "network_throttling", category: "network", title: "Disable network throttling", description: "Stops Windows from capping network traffic while multimedia plays.", badge: "advanced", needs_admin: true, needs_restart: true, keys: ["HKLM\\...\\Multimedia\\SystemProfile"], detail: "Removes the 10 packets/ms cap Windows applies while media plays." },
  { id: "system_responsiveness", category: "network", title: "System responsiveness for games", description: "Reserves fewer CPU cycles for background tasks (20% → 10%).", badge: "advanced", needs_admin: true, needs_restart: true, keys: ["HKLM\\...\\Multimedia\\SystemProfile"], detail: "Gives games more CPU headroom." },
  { id: "games_priority", category: "network", title: "Games task priority", description: "Raises CPU/GPU priority and I/O bandwidth for the 'Games' scheduling class.", badge: "advanced", needs_admin: true, needs_restart: true, keys: ["HKLM\\...\\SystemProfile\\Tasks\\Games"], detail: "Priority=6, Scheduling Category=High, SFIO Priority=High." },
  { id: "nagle_off", category: "network", title: "Disable Nagle's algorithm", description: "Sends small packets immediately instead of batching — can shave ping in some games.", badge: "advanced", needs_admin: true, needs_restart: true, keys: ["HKLM\\SYSTEM\\...\\Tcpip\\Parameters\\Interfaces"], detail: "Effect varies by game; most noticeable in older titles." },
  { id: "animations_off", category: "qol", title: "Reduce window animations", description: "Disables minimise/restore animations and shortens menu delays.", badge: "safe", needs_admin: false, needs_restart: true, keys: ["HKCU\\Control Panel\\Desktop\\WindowMetrics"], detail: "Makes the desktop feel snappier." },
  { id: "startup_delay_off", category: "qol", title: "Remove startup app delay", description: "Removes Windows' staged delay when launching startup apps after sign-in.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["HKCU\\...\\Explorer\\Serialize"], detail: "Your startup apps launch immediately." },
  { id: "background_apps_off", category: "qol", title: "Disable background apps", description: "Stops store apps from running in the background when you're not using them.", badge: "safe", needs_admin: false, needs_restart: true, keys: ["HKCU\\...\\BackgroundAccessApplications"], detail: "More CPU and RAM headroom for games." },
  { id: "advertising_id_off", category: "privacy", title: "Disable advertising ID", description: "Stops Windows from generating an ad-tracking ID for apps.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["HKCU\\...\\AdvertisingInfo"], detail: "No performance impact — just less tracking." },
  { id: "input_personalization_off", category: "privacy", title: "Disable typing personalisation", description: "Stops Windows collecting your typing and inking history in the background.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["HKCU\\InputPersonalization"], detail: "Slightly less background chatter." },
  { id: "tailored_experiences_off", category: "privacy", title: "Disable tailored experiences", description: "Stops Windows using diagnostic data to personalise tips and ads.", badge: "safe", needs_admin: false, needs_restart: false, keys: ["HKCU\\...\\Privacy"], detail: "Instant, no restart." },
  { id: "diagnostic_data_off", category: "privacy", title: "Diagnostic data to minimum", description: "Sets the diagnostic data policy to the lowest level Windows allows.", badge: "advanced", needs_admin: true, needs_restart: false, keys: ["HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection"], detail: "Needs administrator approval (UAC)." },
];

let demoGames = [
  { id: "steam-1", name: "Cyberpunk 2077", exe_name: "Cyberpunk2077.exe", source: "Steam", running: true, tweaks: { disable_cpu0: false, disable_ecores: false, disable_smt: false, fso_off: true } },
  { id: "steam-2", name: "Rocket League", exe_name: "RocketLeague.exe", source: "Steam", running: false, tweaks: { disable_cpu0: true, disable_ecores: false, disable_smt: false, fso_off: false } },
  { id: "epic-1", name: "Fortnite", exe_name: "FortniteClient-Win64-Shipping.exe", source: "Epic", running: false, tweaks: { disable_cpu0: false, disable_ecores: true, disable_smt: false, fso_off: false } },
  { id: "riot-1", name: "VALORANT", exe_name: "VALORANT-Win64-Shipping.exe", source: "Riot", running: false, tweaks: { disable_cpu0: false, disable_ecores: false, disable_smt: false, fso_off: true } },
];

let demoTweakStates = {
  windows_game_mode: true,
  game_dvr_off: true,
  power_plan_high: false,
  mouse_precision_off: false,
  gpu_scheduling: false,
  network_throttling: false,
  system_responsiveness: false,
  games_priority: false,
  nagle_off: false,
  animations_off: false,
  startup_delay_off: true,
  background_apps_off: false,
  advertising_id_off: true,
  input_personalization_off: false,
  tailored_experiences_off: false,
  diagnostic_data_off: false,
};

const demoAddPool = ["Elden Ring", "Hades II", "Baldur's Gate 3", "Apex Legends"];

async function demoInvoke(cmd, args = {}) {
  await sleep(180 + Math.random() * 350);
  switch (cmd) {
    case "load_settings":
      return { ...demoSettings };
    case "save_settings":
      return args.newSettings;
    case "get_app_info":
      return { name: "Optimakerpro", version: "1.0.0", os: "windows", arch: "x86_64" };
    case "get_system_info":
      return {
        os_name: "Windows",
        os_version: "11 (preview data)",
        arch: "x86_64",
        cpu_name: "Preview CPU 8-Core",
        cpu_cores: 8,
        cpu_usage: 14 + Math.random() * 30,
        mem_total_bytes: 17_000_000_000,
        mem_used_bytes: (0.42 + Math.random() * 0.25) * 17_000_000_000,
        process_count: 214,
        uptime_secs: 3600 * (6 + Math.random()),
        disks: [{ mount: "C:\\", total_bytes: 1_000_000_000_000, free_bytes: 310_000_000_000 }],
      };
    case "top_processes":
      return [
        { name: "Cyberpunk2077.exe", memory_bytes: 3_140_000_000 },
        { name: "chrome.exe", memory_bytes: 2_140_000_000 },
        { name: "msedge.exe", memory_bytes: 1_510_000_000 },
        { name: "code.exe", memory_bytes: 980_000_000 },
        { name: "discord.exe", memory_bytes: 640_000_000 },
        { name: "explorer.exe", memory_bytes: 310_000_000 },
        { name: "steam.exe", memory_bytes: 290_000_000 },
        { name: "spotify.exe", memory_bytes: 180_000_000 },
      ];
    case "scan_junk":
      return [
        { id: "user_temp", label: "Temporary files", description: "Leftovers from apps and installers in your user temp folder", size_bytes: 1_930_000_000, file_count: 4812 },
        { id: "windows_temp", label: "Windows temp", description: "System temp files that are safe to remove", size_bytes: 240_000_000, file_count: 310 },
        { id: "update_cache", label: "Windows Update leftovers", description: "Old downloaded update packages", size_bytes: 780_000_000, file_count: 96 },
        { id: "browser_cache", label: "Browser caches", description: "Cached pages and images from Chrome, Edge and Firefox", size_bytes: 1_120_000_000, file_count: 9200 },
        { id: "shader_cache", label: "Shader cache", description: "Compiled GPU shader cache that rebuilds itself as needed", size_bytes: 90_000_000, file_count: 88 },
        { id: "thumbnails", label: "Thumbnail cache", description: "Cached image previews for File Explorer", size_bytes: 30_000_000, file_count: 12 },
        { id: "crash_dumps", label: "Crash dumps", description: "Dumps collected when apps or Windows crashed", size_bytes: 0, file_count: 0 },
      ];
    case "clean_junk": {
      const ids = args.ids || [];
      for (let i = 0; i < ids.length; i++) await sleep(350);
      const total = (state.junk || []).filter((i) => ids.includes(i.id)).reduce((a, b) => a + b.size_bytes, 0);
      return { freed_bytes: total, removed_files: 4210, skipped: 2 };
    }
    case "boost_memory":
      return { trimmed_processes: 9, freed_bytes: 742_000_000, message: "Trimmed 9 processes" };
    case "list_startup":
      return [
        { location: "HKCU", name: "OneDrive", command: 'C:\\Users\\you\\AppData\\OneDrive.exe /background' },
        { location: "HKCU", name: "Discord", command: 'C:\\Users\\you\\AppData\\Discord.exe' },
        { location: "HKLM", name: "SecurityHealth", command: 'C:\\Windows\\System32\\SecurityHealthSystray.exe' },
      ];
    case "remove_startup_item":
      return null;
    case "check_for_updates":
      return {
        current_version: "1.0.0",
        available: true,
        version: "1.0.1",
        notes: "Game Mode fixes, centered settings menu, native window frame.",
        download_size: 6_740_000,
        message: null,
      };
    case "get_tweak_catalog":
      return demoCatalog;
    case "get_tweak_states":
      return demoCatalog.map((d) => ({ id: d.id, active: !!demoTweakStates[d.id], error: null }));
    case "set_tweaks": {
      const ids = args.ids || [];
      const enabled = !!args.enabled;
      for (const id of ids) demoTweakStates[id] = enabled;
      // Mirror the backend: only the requested ids come back, and the mock
      // NEVER fires UI notifications (the real command doesn't either).
      return ids.map((id) => ({ id, active: !!demoTweakStates[id], error: null }));
    }
    case "set_game_mode": {
      const presets = {
        balanced: ["windows_game_mode", "game_dvr_off"],
        performance: ["windows_game_mode", "game_dvr_off", "power_plan_high", "startup_delay_off", "background_apps_off"],
      };
      if (args.mode === "custom") {
        // Custom touches nothing (mirrors the backend no-op).
        return demoCatalog.map((d) => ({ id: d.id, active: !!demoTweakStates[d.id], error: null }));
      }
      const ids = presets[args.mode];
      if (!ids) throw new Error(`Unknown mode: ${args.mode}`);
      // Turn off safe tweaks the preset doesn't include (mirrors the backend).
      for (const def of demoCatalog) {
        if (!def.needs_admin && !ids.includes(def.id)) demoTweakStates[def.id] = false;
      }
      for (const id of ids) demoTweakStates[id] = true;
      return ids.map((id) => ({ id, active: true, error: null }));
    }
    case "get_core_topology":
      return { cores: 8, logical: 16, e_cores: 0, smt: true };
    case "list_games":
      return demoGames;
    case "add_game_from_path": {
      const name = demoAddPool.pop() || "New Game";
      const g = { id: `manual-${Date.now()}`, name, exe_name: `${name.replace(/[^a-z]/gi, "")}.exe`, source: "Manual", running: false, tweaks: { disable_cpu0: false, disable_ecores: false, disable_smt: false, fso_off: false } };
      demoGames.push(g);
      return g;
    }
    case "remove_game": {
      demoGames = demoGames.filter((g) => g.id !== args.id);
      return null;
    }
    case "set_game_tweak": {
      const g = demoGames.find((x) => x.id === args.gameId);
      if (g && g.tweaks[args.tweak] !== undefined) g.tweaks[args.tweak] = !!args.enabled;
      return g ? g.tweaks : null;
    }
    case "boost_game":
      return "Game pinned to the selected cores (preview data)";
    default:
      return null;
  }
}

/* ============================================================
   Navigation
   ============================================================ */

const PAGE_TITLES = {
  dashboard: "Dashboard",
  cleanup: "Cleanup",
  performance: "Performance",
  game: "Game Mode",
  settings: "Settings",
};

function setPage(page) {
  state.page = page;
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === `page-${page}`));
  $("#pageTitle").textContent = PAGE_TITLES[page] || "Optimakerpro";
  if (page === "performance") refreshPerformancePage();
  if (page === "game") refreshGameData();
}

/* ============================================================
   Settings
   ============================================================ */

async function loadSettings() {
  try {
    state.settings = await invoke("load_settings");
  } catch {
    state.settings = { ...demoSettings };
  }
  syncSettingUI();
}

function persistSettings() {
  const payload = { newSettings: state.settings };
  return invoke("save_settings", payload)
    .then(() => true)
    .catch((e) => {
      toast("Couldn't save settings", { body: String(e), kind: "err" });
      return false;
    });
}

function syncSettingUI() {
  const s = state.settings;
  if (!s) return;
  $$(".switch[data-setting]").forEach((sw) => {
    sw.setAttribute("aria-checked", String(!!s[sw.dataset.setting]));
  });
  $("#silentChip").classList.toggle("on", !!s.silentMode);
  $("#cleanupInterval").value = String(s.cleanupIntervalHours);
  document.body.classList.toggle("no-anim", !!s.reduceAnimations);
}

async function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  syncSettingUI();
  await persistSettings();
  const names = {
    autoMemoryBoost: "Auto Memory Boost",
    autoCleanup: "Auto Cleanup",
    silentMode: "Silent / Game Mode",
    launchOnStartup: "Launch on startup",
    reduceAnimations: "Reduce animations",
  };
  toast(`${names[key] || key} ${state.settings[key] ? "enabled" : "disabled"}`, {
    kind: state.settings[key] ? "good" : "",
    body: key === "silentMode" && state.settings[key] ? "Background scans and notifications are paused." : "",
  });
}

/* ============================================================
   Dashboard
   ============================================================ */

const RING_CIRCUMFERENCE = 527.79;

function computeScore(snap) {
  if (!snap) return null;
  const memPct = snap.mem_total_bytes ? (snap.mem_used_bytes / snap.mem_total_bytes) * 100 : 0;
  let junkPenalty = 0;
  if (state.junk) {
    const gb = state.junk.reduce((a, b) => a + b.size_bytes, 0) / 1024 ** 3;
    junkPenalty = Math.min(15, gb * 2);
  }
  return Math.max(5, Math.min(100, Math.round(100 - snap.cpu_usage * 0.3 - memPct * 0.4 - junkPenalty)));
}

let lastScore = 50;

function renderStats() {
  const snap = state.snapshot;
  if (!snap) return;
  const memPct = snap.mem_total_bytes ? (snap.mem_used_bytes / snap.mem_total_bytes) * 100 : 0;

  $("#statMem").textContent = `${Math.round(memPct)}%`;
  $("#statMemSub").textContent = `${fmtGB(snap.mem_used_bytes)} of ${fmtGB(snap.mem_total_bytes)} used`;
  $("#statCpu").textContent = `${Math.round(snap.cpu_usage)}%`;
  $("#statCpuSub").textContent = `${snap.cpu_name} · ${snap.cpu_cores} cores`;

  const mainDisk = (snap.disks || []).slice().sort((a, b) => b.total_bytes - a.total_bytes)[0];
  if (mainDisk) {
    const freePct = Math.round((mainDisk.free_bytes / mainDisk.total_bytes) * 100);
    $("#statDisk").textContent = `${freePct}% free`;
    $("#statDiskSub").textContent = `${fmtGB(mainDisk.free_bytes)} free of ${fmtGB(mainDisk.total_bytes)} on ${mainDisk.mount}`;
  }

  const score = computeScore(snap);
  if (score !== null) {
    const arc = $("#scoreArc");
    arc.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - score / 100));
    animateNumber($("#scoreValue"), lastScore, score, 700);
    lastScore = score;
    const headline =
      score >= 85 ? "Excellent" :
      score >= 70 ? "All good" :
      score >= 50 ? "Fair — a cleanup would help" :
      "Needs attention";
    $("#scoreHeadline").textContent = headline;
    $("#scoreSub").textContent =
      `${snap.os_name} ${snap.os_version} · ${snap.process_count} processes · up ${Math.floor(snap.uptime_secs / 3600)}h`;
  }
}

async function pollStats() {
  if (document.hidden) return;
  try {
    state.snapshot = await invoke("get_system_info");
    renderStats();
    if (state.page === "performance") {
      $("#memPercent").textContent = `${Math.round(
        (state.snapshot.mem_used_bytes / Math.max(1, state.snapshot.mem_total_bytes)) * 100
      )}%`;
      $("#memBar").style.width = `${(state.snapshot.mem_used_bytes / Math.max(1, state.snapshot.mem_total_bytes)) * 100}%`;
      $("#memDetail").textContent = `${fmtGB(state.snapshot.mem_used_bytes)} used · ${fmtGB(
        state.snapshot.mem_total_bytes - state.snapshot.mem_used_bytes
      )} available`;
      $("#cpuPercent").textContent = `${Math.round(state.snapshot.cpu_usage)}%`;
      $("#cpuBar").style.width = `${state.snapshot.cpu_usage}%`;
      $("#cpuDetail").textContent = state.snapshot.cpu_name;
      $("#cpuCores").textContent = state.snapshot.cpu_cores;
      $("#procCount").textContent = state.snapshot.process_count;
      $("#uptimeVal").textContent = `${Math.floor(state.snapshot.uptime_secs / 3600)}h`;
    }
  } catch {
    /* keep polling silently */
  }
}

function pushActivity({ icon = "good", title, sub }) {
  state.activity.unshift({ icon, title, sub: sub || timeAgo(Date.now()), at: Date.now() });
  state.activity = state.activity.slice(0, 8);
  renderActivity();
}

function renderActivity() {
  const list = $("#activityList");
  const items = [];
  state.history.cleans.slice(0, 6).forEach((c) =>
    items.push({ icon: "good", title: `Freed ${fmtBytes(c.freed)}`, sub: `Junk cleanup · ${timeAgo(c.at)}`, at: c.at })
  );
  state.history.boosts.slice(0, 6).forEach((b) =>
    items.push({ icon: "warn", title: `Freed ${fmtBytes(b.freed)} of memory`, sub: `Memory boost · ${timeAgo(b.at)}`, at: b.at })
  );
  state.activity.forEach((a) => items.push(a));
  items.sort((a, b) => b.at - a.at);
  const top = items.slice(0, 8);
  if (!top.length) {
    list.innerHTML = `<li class="activity-empty">Nothing yet — cleanups, boosts and game sessions will show up here.</li>`;
    return;
  }
  list.innerHTML = top
    .map(
      (i) => `
    <li>
      <span class="act-icon ${i.icon}">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <div class="act-body"><strong>${esc(i.title)}</strong><span>${esc(i.sub)}</span></div>
    </li>`
    )
    .join("");
}

/* Optimize now: safe quick sweep + memory boost */
async function optimizeNow() {
  const btn = $("#optimizeBtn");
  const wrap = $("#optimizeProgress");
  const bar = $("#optimizeBar");
  const label = $("#optimizeStatus");
  btn.classList.add("busy");
  wrap.classList.remove("hidden");
  label.textContent = "Sweeping temp files…";
  bar.classList.add("indeterminate");
  await animateBar(bar, 35, 900);
  try {
    const ids = ["user_temp", "shader_cache", "thumbnails", "crash_dumps"];
    const res = await invoke("clean_junk", { ids });
    label.textContent = "Boosting memory…";
    await animateBar(bar, 70, 700);
    const boost = await invoke("boost_memory");
    await animateBar(bar, 100, 500);
    state.history.cleans.unshift({ at: Date.now(), freed: res.freed_bytes });
    state.history.cleans = state.history.cleans.slice(0, 20);
    state.history.boosts.unshift({ at: Date.now(), freed: boost.freed_bytes });
    state.history.boosts = state.history.boosts.slice(0, 20);
    saveJSON("opm-history", state.history);
    renderActivity();
    toast(`Freed ${fmtBytes(res.freed_bytes + boost.freed_bytes)} total`, {
      kind: "good",
      body: `Cleanup: ${fmtBytes(res.freed_bytes)} · Memory: ${fmtBytes(boost.freed_bytes)}`,
    });
    state.junk = null;
    $("#statJunk").textContent = "Run a scan";
    $("#statJunkSub").textContent = "from the Cleanup page";
  } catch (e) {
    toast("Optimization hit a snag", { body: String(e), kind: "err" });
  } finally {
    btn.classList.remove("busy");
    bar.classList.remove("indeterminate");
    setTimeout(() => {
      wrap.classList.add("hidden");
      bar.style.width = "0%";
    }, 700);
  }
}

/* ============================================================
   Cleanup page
   ============================================================ */

function renderCleanList() {
  const list = $("#cleanList");
  const items = state.junk || [];
  if (!items.length) {
    list.innerHTML = `<li class="list-empty">Run a scan to see what can be cleaned.</li>`;
    return;
  }
  list.innerHTML = items
    .map(
      (item) => `
    <li class="clean-row" data-id="${esc(item.id)}">
      <input type="checkbox" checked data-id="${esc(item.id)}" aria-label="Select ${esc(item.label)}" />
      <div class="clean-info"><strong>${esc(item.label)}</strong><span>${esc(item.description)}</span></div>
      <span class="clean-size">${fmtBytes(item.size_bytes)}</span>
      <span class="clean-state"></span>
    </li>`
    )
    .join("");
  list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", updateCleanSelection);
  });
  updateCleanSelection();
  $("#itemsCard").classList.remove("hidden");
}

function selectedIds() {
  return $$("#cleanList input[type=checkbox]:checked").map((cb) => cb.dataset.id);
}

function updateCleanSelection() {
  const items = state.junk || [];
  const ids = selectedIds();
  const total = items.filter((i) => ids.includes(i.id)).reduce((a, b) => a + b.size_bytes, 0);
  $("#cleanBtn").disabled = ids.length === 0;
  $("#junkTotal").textContent = `${ids.length}/${items.length} selected · ${fmtBytes(total)}`;
  const allChecked = ids.length === items.length && items.length > 0;
  $("#checkAll").checked = allChecked;
}

async function scanJunk() {
  const btn = $("#scanBtn");
  const wrap = $("#scanProgress");
  const bar = $("#scanBar");
  const label = $("#scanStatus");
  btn.classList.add("busy");
  wrap.classList.remove("hidden");
  label.textContent = "Scanning temp folders and caches…";
  bar.classList.add("indeterminate");
  $("#cleanSummary").classList.add("hidden");
  try {
    const items = await invoke("scan_junk");
    state.junk = items;
    renderCleanList();
    const total = items.reduce((a, b) => a + b.size_bytes, 0);
    $("#statJunk").textContent = fmtBytes(total);
    $("#statJunkSub").textContent = `${items.reduce((a, b) => a + b.file_count, 0)} files found`;
    label.textContent = `Found ${fmtBytes(total)} of junk`;
  } catch (e) {
    toast("Scan failed", { body: String(e), kind: "err" });
    label.textContent = "Scan failed";
  } finally {
    btn.classList.remove("busy");
    bar.classList.remove("indeterminate");
    await animateBar(bar, 100, 300);
    setTimeout(() => {
      wrap.classList.add("hidden");
      bar.style.width = "0%";
    }, 600);
  }
}

async function cleanSelected() {
  const btn = $("#cleanBtn");
  const ids = selectedIds();
  if (!ids.length) return;
  btn.classList.add("busy");
  const rows = new Map($$("#cleanList .clean-row").map((r) => [r.dataset.id, r]));
  ids.forEach((id) => {
    const row = rows.get(id);
    if (row) row.querySelector(".clean-state").innerHTML = `<span class="spinner"></span>`;
  });
  try {
    const res = await invoke("clean_junk", { ids });
    ids.forEach((id) => {
      const row = rows.get(id);
      if (row) {
        row.classList.add("done");
        row.querySelector(".clean-state").textContent = "✓";
      }
    });
    state.history.cleans.unshift({ at: Date.now(), freed: res.freed_bytes });
    state.history.cleans = state.history.cleans.slice(0, 20);
    saveJSON("opm-history", state.history);
    renderActivity();
    const summary = $("#cleanSummary");
    summary.textContent = `Freed ${fmtBytes(res.freed_bytes)} — ${res.removed_files} files removed${
      res.skipped ? `, ${res.skipped} locked files skipped` : ""
    }.`;
    summary.classList.remove("hidden");
    toast(`Freed ${fmtBytes(res.freed_bytes)}`, { kind: "good", body: `${res.removed_files} files removed.` });
    setTimeout(() => scanJunk(), 1200);
  } catch (e) {
    toast("Cleanup failed", { body: String(e), kind: "err" });
  } finally {
    btn.classList.remove("busy");
  }
}

function renderHistory() {
  const list = $("#historyList");
  const cleans = state.history.cleans.slice(0, 8);
  if (!cleans.length) {
    list.innerHTML = `<li class="list-empty">No cleanups yet.</li>`;
    return;
  }
  list.innerHTML = cleans
    .map(
      (c) => `
    <li>
      <span class="h-when">${esc(timeAgo(c.at))}</span>
      <span class="h-amt">${esc(fmtBytes(c.freed))} freed</span>
    </li>`
    )
    .join("");
}

/* ============================================================
   Performance page
   ============================================================ */

async function refreshPerformancePage() {
  try {
    const procs = await invoke("top_processes", { limit: 8 });
    const list = $("#procList");
    const max = Math.max(...procs.map((p) => p.memory_bytes), 1);
    list.innerHTML = procs
      .map(
        (p, i) => `
      <li>
        <span class="proc-rank">${i + 1}</span>
        <span class="proc-name">${esc(p.name)}</span>
        <span class="proc-bar"><span class="bar" style="width:90px"><i style="width:${Math.max(4, (p.memory_bytes / max) * 100)}%"></i></span></span>
        <span class="proc-mem">${esc(fmtBytes(p.memory_bytes))}</span>
      </li>`
      )
      .join("");
  } catch {
    /* ignore */
  }
  try {
    const items = await invoke("list_startup");
    renderStartup(items);
  } catch {
    $("#startupList").innerHTML = `<li class="list-empty">Startup list is only available on Windows.</li>`;
  }
}

function renderStartup(items) {
  const list = $("#startupList");
  if (!items.length) {
    list.innerHTML = `<li class="list-empty">No startup entries found.</li>`;
    return;
  }
  list.innerHTML = items
    .map(
      (item, i) => `
    <li data-i="${i}">
      <span class="loc-badge">${esc(item.location)}</span>
      <div class="startup-name"><strong>${esc(item.name)}</strong><span>${esc(item.command)}</span></div>
      <button class="btn btn-sm btn-ghost btn-ghost-danger" data-remove="${esc(item.name)}" data-loc="${esc(item.location)}">Remove</button>
    </li>`
    )
    .join("");
  list.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const name = btn.dataset.remove;
      const location = btn.dataset.loc;
      if (!confirm(`Remove "${name}" from startup?`)) return;
      try {
        await invoke("remove_startup_item", { location, name });
        toast(`${name} removed from startup`, { kind: "good" });
        refreshPerformancePage();
      } catch (e) {
        toast("Couldn't remove startup item", { body: String(e), kind: "err" });
      }
    });
  });
}

async function boostMemory() {
  const btn = $("#boostBtn");
  const wrap = $("#boostProgress");
  const bar = $("#boostBar");
  btn.classList.add("busy");
  wrap.classList.remove("hidden");
  bar.classList.add("indeterminate");
  try {
    const res = await invoke("boost_memory");
    state.history.boosts.unshift({ at: Date.now(), freed: res.freed_bytes });
    state.history.boosts = state.history.boosts.slice(0, 20);
    saveJSON("opm-history", state.history);
    renderActivity();
    $("#boostResult").textContent = res.freed_bytes
      ? `Freed ${fmtBytes(res.freed_bytes)} by trimming ${res.trimmed_processes} processes.`
      : res.message;
    toast(`Freed ${fmtBytes(res.freed_bytes)}`, { kind: "good", body: res.message });
    pollStats();
  } catch (e) {
    toast("Boost failed", { body: String(e), kind: "err" });
  } finally {
    btn.classList.remove("busy");
    bar.classList.remove("indeterminate");
    setTimeout(() => wrap.classList.add("hidden"), 500);
  }
}

/* ============================================================
   Game Mode
   ============================================================ */

async function refreshGameData() {
  try {
    const [games, catalog, states, topology] = await Promise.all([
      invoke("list_games"),
      invoke("get_tweak_catalog"),
      invoke("get_tweak_states"),
      invoke("get_core_topology"),
    ]);
    state.games = games;
    state.catalog = catalog;
    state.tweakStates = Object.fromEntries(states.map((s) => [s.id, s]));
    state.topology = topology;
    renderGames();
    renderTweaks();
    updateGameBanner();
  } catch (e) {
    toast("Couldn't load Game Mode data", { body: String(e), kind: "err" });
  }
}

function categoryLabel(cat) {
  return {
    fps: "FPS & Latency",
    network: "Network & Ping",
    qol: "Quality of Life",
    privacy: "Privacy & Security",
  }[cat] || cat;
}

function renderGames() {
  const row = $("#gamesRow");
  const cards = state.games
    .map((g) => {
      const hue = hueFromString(g.name);
      return `
      <div class="card game-card ${g.running ? "running" : ""}" data-id="${esc(g.id)}">
        <div class="game-avatar" style="--h:${hue}">${esc(g.name.charAt(0).toUpperCase())}</div>
        <div class="game-meta">
          <strong title="${esc(g.name)}">${esc(g.name)}</strong>
          <span class="game-src">${esc(g.source)}${g.running ? ' <span class="running-dot"></span>' : ""}</span>
        </div>
        <div class="game-card-actions">
          <button class="btn btn-sm" data-tweaks="${esc(g.id)}">Tweaks</button>
          <button class="icon-btn-x" data-remove="${esc(g.id)}" title="Remove from list">✕</button>
        </div>
      </div>`;
    })
    .join("");
  row.innerHTML =
    cards +
    `<button class="card add-game-card" id="addGameCard"><span class="plus">+</span>Add game</button>`;
  row.querySelectorAll("[data-tweaks]").forEach((btn) => {
    btn.addEventListener("click", () => openGameTweaks(btn.dataset.tweaks));
  });
  row.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.remove;
      const game = state.games.find((g) => g.id === id);
      if (!confirm(`Remove "${game ? game.name : "this game"}" from My Games?`)) return;
      try {
        await invoke("remove_game", { id });
        await refreshGameData();
        toast("Removed from My Games", { kind: "good" });
      } catch (e) {
        toast("Couldn't remove", { body: String(e), kind: "err" });
      }
    });
  });
  $("#addGameCard").addEventListener("click", addGame);
}

async function addGame() {
  if (isTauri && T.dialog && T.dialog.open) {
    try {
      const path = await T.dialog.open({
        multiple: false,
        title: "Pick the game's .exe file",
        filters: [{ name: "Game executable", extensions: ["exe"] }],
      });
      if (!path) return;
      await invoke("add_game_from_path", { path });
      await refreshGameData();
      toast("Game added", { kind: "good" });
    } catch (e) {
      toast("Couldn't add game", { body: String(e), kind: "err" });
    }
  } else {
    await invoke("add_game_from_path", { path: "demo" });
    await refreshGameData();
    toast("Game added (preview data)", { kind: "good" });
  }
}

function renderTweaks() {
  const grid = $("#tweaksGrid");
  const items = state.catalog.filter((d) => state.gameCat === "all" || d.category === state.gameCat);
  if (!items.length) {
    grid.innerHTML = `<div class="card tweak-card"><p class="muted">No optimizations in this category.</p></div>`;
    return;
  }
  grid.innerHTML = items
    .map((d) => {
      const st = state.tweakStates[d.id] || { active: false };
      const chips = [
        `<span class="chip-cat">${esc(categoryLabel(d.category))}</span>`,
        `<span class="badge ${d.badge}">${d.badge === "safe" ? "Safe" : "Advanced"}</span>`,
        d.needs_admin ? `<span class="badge admin">Admin</span>` : "",
        st.active && d.needs_restart ? `<span class="badge restart">Restart needed</span>` : "",
      ].join("");
      return `
      <div class="card tweak-card ${st.active ? "active" : ""}">
        <div class="tweak-chips">${chips}</div>
        <strong class="tweak-title">${esc(d.title)}</strong>
        <p class="tweak-desc">${esc(d.description)}</p>
        <div class="tweak-foot">
          <button class="icon-info" data-info="${esc(d.id)}" title="What this changes" aria-label="Details about ${esc(d.title)}">i</button>
          <span class="activate-label ${st.active ? "on" : ""}" data-activate="${esc(d.id)}">
            <span>${st.active ? "Active" : "Activate"}</span>
            <button class="switch" data-tweak="${esc(d.id)}" aria-checked="${st.active}" aria-label="Toggle ${esc(d.title)}"><span class="knob"></span></button>
          </span>
        </div>
      </div>`;
    })
    .join("");

  grid.querySelectorAll("[data-tweak]").forEach((sw) => {
    sw.addEventListener("click", () => toggleTweak(sw.dataset.tweak));
  });
  grid.querySelectorAll("[data-info]").forEach((btn) => {
    btn.addEventListener("click", () => showTweakInfo(btn.dataset.info));
  });
}

async function toggleTweak(id) {
  const def = state.catalog.find((d) => d.id === id);
  if (!def) return;
  const current = state.tweakStates[id]?.active || false;
  const enabling = !current;

  if (enabling && def.needs_admin) {
    toast("Windows will ask for permission", {
      kind: "",
      body: "Click Yes on the UAC prompt to apply this optimization.",
    });
  }

  const switchEl = $(`[data-tweak="${CSS.escape(id)}"]`);
  if (switchEl) switchEl.classList.add("tweak-switch-busy");
  try {
    const states = await invoke("set_tweaks", { ids: [id], enabled: enabling });
    states.forEach((s) => {
      state.tweakStates[s.id] = s;
    });
    summarizeTweakResults(states, enabling, def.title);
    renderTweaks();
  } catch (e) {
    toast("Couldn't apply", { body: String(e), kind: "err" });
  } finally {
    if (switchEl) switchEl.classList.remove("tweak-switch-busy");
  }
}

function showTweakInfo(id) {
  const def = state.catalog.find((d) => d.id === id);
  if (!def) return;
  const st = state.tweakStates[id] || { active: false };
  openModal(`
    <h2>${esc(def.title)}
      <span class="badge ${def.badge}">${def.badge === "safe" ? "Safe" : "Advanced"}</span>
      ${st.active ? `<span class="badge safe">Active</span>` : ""}
    </h2>
    <p class="modal-sub muted">${esc(def.description)}</p>
    <p class="modal-detail">${esc(def.detail)}</p>
    ${def.needs_restart ? `<p class="modal-detail"><strong>Restart:</strong> a PC restart is needed for this to fully apply.</p>` : ""}
    ${def.needs_admin ? `<p class="modal-detail"><strong>Administrator:</strong> Windows will show a UAC prompt.</p>` : ""}
    <div class="modal-keys">${def.keys.map((k) => esc(k)).join("<br>")}</div>
    <div class="modal-actions">
      <button class="btn" id="infoClose">Close</button>
    </div>
  `);
  $("#infoClose").addEventListener("click", closeModal);
}

/* Game-specific tweaks modal */
function openGameTweaks(gameId) {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return;
  const topo = state.topology || { e_cores: 0, smt: false };
  const t = game.tweaks || {};
  const pending = { ...t };

  const rows = [];
  const rowTpl = (key, iconSvg, title, badge, desc, note) => `
    <div class="gt-row">
      <span class="gt-icon">${iconSvg}</span>
      <div class="gt-body">
        <div class="gt-title">${esc(title)} <span class="badge ${badge}">${badge === "safe" ? "Safe" : "Advanced"}</span></div>
        <p>${esc(desc)}</p>
        ${note ? `<div class="gt-note">${esc(note)}</div>` : ""}
      </div>
      <button class="switch" data-gt="${key}" aria-checked="${!!pending[key]}" aria-label="Toggle ${esc(title)}"><span class="knob"></span></button>
    </div>`;

  rows.push(
    rowTpl(
      "disable_cpu0",
      `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10h-10z"/></svg>`,
      "Disable CPU 0",
      "safe",
      "Keeps the game off Windows' busiest core so it runs smoother.",
      ""
    )
  );

  rows.push(
    rowTpl(
      "disable_ecores",
      `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16"/><path d="M12 4v16"/></svg>`,
      "Disable E-Cores",
      "safe",
      "Runs the game only on your strongest performance cores for better consistency.",
      topo.e_cores === 0 ? (state.topology ? "No efficiency cores detected on this CPU." : "") : ""
    )
  );

  rows.push(
    rowTpl(
      "disable_smt",
      `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
      "Disable SMT/Hyperthreading",
      "advanced",
      "Restricts the game to physical cores only for more predictable frame times.",
      topo.smt ? "" : "Hyperthreading not detected — nothing to disable."
    )
  );

  rows.push(
    rowTpl(
      "fso_off",
      `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`,
      "Disable Fullscreen Optimizations",
      "safe",
      "Skips Windows' borderless-fullscreen wrapper for lower input latency.",
      "Applies the next time the game launches."
    )
  );

  const box = openModal(`
    <h2>${esc(game.name)} tweaks</h2>
    <p class="modal-sub muted">
      Core topology: ${topo.cores || "?"} cores · ${topo.logical || "?"} threads
      ${topo.e_cores ? ` · ${topo.e_cores} E-cores` : ""}
    </p>
    ${rows.join("")}
    <div class="modal-actions">
      <button class="btn" id="gtCancel">Cancel</button>
      <button class="btn btn-primary" id="gtActivate">Activate</button>
    </div>
  `);

  box.querySelectorAll("[data-gt]").forEach((sw) => {
    const key = sw.dataset.gt;
    if (key === "disable_ecores" && topo.e_cores === 0 && state.topology) {
      sw.disabled = true;
      sw.style.opacity = "0.35";
      sw.style.cursor = "not-allowed";
    }
    if (key === "disable_smt" && !topo.smt) {
      sw.disabled = true;
      sw.style.opacity = "0.35";
      sw.style.cursor = "not-allowed";
    }
    sw.addEventListener("click", () => {
      pending[key] = !pending[key];
      sw.setAttribute("aria-checked", String(pending[key]));
    });
  });

  $("#gtCancel").addEventListener("click", closeModal);
  $("#gtActivate").addEventListener("click", async () => {
    const btn = $("#gtActivate");
    btn.classList.add("busy");
    try {
      for (const [key, enabled] of Object.entries(pending)) {
        if (t[key] === enabled) continue;
        await invoke("set_game_tweak", { gameId: gameId, tweak: key, enabled: enabled });
      }
      closeModal();
      await refreshGameData();
      toast("Tweaks activated", {
        kind: "good",
        body: game.running
          ? `${game.name} is running — affinity applied instantly.`
          : `They'll apply automatically next time ${game.name} launches.`,
      });
    } catch (e) {
      toast("Couldn't apply all tweaks", { body: String(e), kind: "err" });
    } finally {
      btn.classList.remove("busy");
    }
  });
}

function updateGameBanner() {
  const pill = $("#gmPill");
  const pillText = $("#gmPillText");
  const statusText = $("#gmStatusText");
  const boostBtn = $("#boostGameBtn");
  const running = state.games.find((g) => g.running) || null;
  state.runningGame = running;

  if (running) {
    pill.classList.add("on");
    pillText.textContent = "GAME MODE ON";
    statusText.textContent = `${running.name} is running — your tweaks are active.`;
    boostBtn.classList.remove("hidden");
  } else {
    pill.classList.remove("on");
    pillText.textContent = "NO GAME RUNNING";
    statusText.textContent = "Detection is on — launch a game.";
    boostBtn.classList.add("hidden");
  }
}

async function switchMode(mode) {
  const pills = $$("#modePills .mode-pill");
  pills.forEach((p) => p.classList.toggle("active", p.dataset.mode === mode));
  const pill = $(`.mode-pill[data-mode="${mode}"]`);
  pill.classList.add("busy");
  try {
    const states = await invoke("set_game_mode", { mode: mode });
    states.forEach((s) => {
      state.tweakStates[s.id] = s;
    });
    const failed = states.filter((s) => s.error);
    if (failed.length) {
      toast("Not applied", { kind: "err", body: failed[0].error });
    }
    state.mode = mode;
    renderTweaks();
    if (mode !== "custom") {
      const activeCount = states.filter((s) => s.active).length;
      toast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`, {
        kind: "good",
        body: `${activeCount} optimizations active. Advanced tweaks stay opt-in.`,
      });
    } else {
      toast("Custom mode", { body: "Toggle the tweaks you want — nothing was changed for you." });
    }
  } catch (e) {
    toast("Couldn't switch mode", { body: String(e), kind: "err" });
    pills.forEach((p) => p.classList.toggle("active", p.dataset.mode === state.mode));
  } finally {
    pill.classList.remove("busy");
  }
}

async function boostGameNow() {
  const game = state.runningGame;
  if (!game) return;
  try {
    const msg = await invoke("boost_game", { gameId: game.id });
    toast("Game boosted", { kind: "good", body: msg });
  } catch (e) {
    // Fall back to a general memory trim.
    try {
      const res = await invoke("boost_memory");
      toast(`Freed ${fmtBytes(res.freed_bytes)}`, { kind: "good", body: "No core tweaks for this game — trimmed memory instead." });
    } catch (e2) {
      toast("Boost failed", { body: String(e), kind: "err" });
    }
  }
}

/* ============================================================
   Updates
   ============================================================ */

function setUpdateStatus(text, cls = "") {
  const el = $("#updateStatus");
  el.textContent = text;
  el.className = `muted ${cls}`;
}

async function checkForUpdates(manual) {
  if (state.update.checking) return;
  state.update.checking = true;
  const btn = $("#checkUpdatesBtn");
  const note = $("#updateNote");
  btn.classList.add("busy");
  note.textContent = "";
  if (manual) setUpdateStatus("Checking for updates…");
  try {
    const info = await invoke("check_for_updates");
    state.update = { available: info.available, version: info.version, checking: false };
    if (info.available) {
      setUpdateStatus(`Version ${info.version} is available (you're on v${info.current_version}).`);
      $("#installUpdateBtn").classList.remove("hidden");
      if (manual) toast(`Update ${info.version} available`, { kind: "good", body: fmtBytes(info.download_size) });
    } else {
      setUpdateStatus(`You're on the latest version (v${info.current_version}).`);
      $("#installUpdateBtn").classList.add("hidden");
    }
  } catch (e) {
    state.update.checking = false;
    setUpdateStatus(`Update check failed (v${$("#versionPill").textContent.replace("v", "")}).`, "");
    note.textContent = String(e);
    note.className = "update-note muted err";
  } finally {
    btn.classList.remove("busy");
  }
}

async function installUpdate() {
  const note = $("#updateNote");
  const wrap = $("#updateProgressWrap");
  const bar = $("#updateBar");
  const label = $("#updateProgressLabel");
  $("#installUpdateBtn").classList.add("hidden");
  $("#checkUpdatesBtn").classList.add("busy");
  wrap.classList.remove("hidden");
  label.textContent = "Downloading update…";
  note.textContent = "";
  note.className = "update-note muted";

  if (!isTauri) {
    // Preview mode: simulate a real download + install so the flow is visible.
    const total = 6_740_000;
    let done = 0;
    bar.classList.remove("indeterminate");
    await sleep(250);
    while (done < total) {
      done = Math.min(total, done + 220_000 + Math.random() * 500_000);
      bar.style.transition = "width 0.25s ease";
      bar.style.width = `${(done / total) * 100}%`;
      label.textContent = `Downloading… ${fmtBytes(done)} / ${fmtBytes(total)}`;
      await sleep(140);
    }
    label.textContent = "Downloaded — installing…";
    await sleep(1400);
    label.textContent = "Installed — restarting Optimakerpro…";
    $("#checkUpdatesBtn").classList.remove("busy");
    toast("Update installed", { kind: "good", body: "Optimakerpro v1.0.1 is now the current version." });
    setUpdateStatus("You're on the latest version (v1.0.1).");
    $("#versionPill").textContent = "v1.0.1";
    const about = $("#aboutInfo");
    if (about) {
      about.textContent = `Version 1.0.1 · Windows (x86_64)`;
    }
    setTimeout(() => {
      wrap.classList.add("hidden");
      bar.style.width = "0%";
    }, 1600);
    return;
  }

  bar.classList.add("indeterminate");
  try {
    await invoke("install_update");
    label.textContent = "Downloaded — installing…";
  } catch (e) {
    wrap.classList.add("hidden");
    bar.classList.remove("indeterminate");
    note.textContent = String(e);
    note.className = "update-note muted err";
    $("#checkUpdatesBtn").classList.remove("busy");
  }
}

function onUpdateProgress(payload) {
  const bar = $("#updateBar");
  const label = $("#updateProgressLabel");
  if (payload.total > 0) {
    bar.classList.remove("indeterminate");
    bar.style.transition = "width 0.3s ease";
    bar.style.width = `${Math.min(100, (payload.downloaded / payload.total) * 100)}%`;
    label.textContent = `Downloading… ${fmtBytes(payload.downloaded)} / ${fmtBytes(payload.total)}`;
  } else {
    label.textContent = `Downloading… ${fmtBytes(payload.downloaded)}`;
  }
}

/* ============================================================
   Wiring
   ============================================================ */

function wire() {
  // Navigation
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => setPage(btn.dataset.page));
  });

  // Settings toggles
  $$(".switch[data-setting]").forEach((sw) => {
    sw.addEventListener("click", () => toggleSetting(sw.dataset.setting));
  });

  $("#cleanupInterval").addEventListener("change", async (e) => {
    state.settings.cleanupIntervalHours = parseInt(e.target.value, 10) || 12;
    await persistSettings();
    toast("Cleanup interval saved", { kind: "good" });
  });

  $("#silentChip").addEventListener("click", () => toggleSetting("silentMode"));

  // Dashboard
  $("#optimizeBtn").addEventListener("click", optimizeNow);
  $("#gameTileBtn").addEventListener("click", () => setPage("game"));

  // Cleanup
  $("#scanBtn").addEventListener("click", scanJunk);
  $("#cleanBtn").addEventListener("click", cleanSelected);
  $("#checkAll").addEventListener("change", (e) => {
    $$("#cleanList input[type=checkbox]").forEach((cb) => (cb.checked = e.target.checked));
    updateCleanSelection();
  });

  // Performance
  $("#boostBtn").addEventListener("click", boostMemory);

  // Game Mode
  $$("#modePills .mode-pill").forEach((pill) => {
    pill.addEventListener("click", () => switchMode(pill.dataset.mode));
  });
  $("#editModeBtn").addEventListener("click", () => {
    $("#tweaksGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#addGameBtn").addEventListener("click", addGame);
  $("#boostGameBtn").addEventListener("click", boostGameNow);
  $$("#catTabs .cat-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.gameCat = tab.dataset.cat;
      $$("#catTabs .cat-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderTweaks();
    });
  });

  // Settings
  $("#checkUpdatesBtn").addEventListener("click", () => checkForUpdates(true));
  $("#installUpdateBtn").addEventListener("click", installUpdate);
  $("#settingsCloseBtn").addEventListener("click", () => setPage("dashboard"));

  if (isTauri) {
    T.event.listen("clean-progress", (e) => {
      const { id } = e.payload || {};
      const row = $(`#cleanList .clean-row[data-id="${CSS.escape(id)}"]`);
      if (row) row.querySelector(".clean-state").innerHTML = `<span class="spinner"></span>`;
    });
    T.event.listen("auto-cleaned", (e) => {
      const { freedBytes, removedFiles } = e.payload || {};
      state.history.cleans.unshift({ at: Date.now(), freed: freedBytes });
      state.history.cleans = state.history.cleans.slice(0, 20);
      saveJSON("opm-history", state.history);
      renderActivity();
      toast(`Auto cleanup freed ${fmtBytes(freedBytes)}`, {
        kind: "good",
        body: `${removedFiles} files removed automatically.`,
      });
    });
    T.event.listen("auto-boost", (e) => {
      const { freedBytes } = e.payload || {};
      state.history.boosts.unshift({ at: Date.now(), freed: freedBytes });
      state.history.boosts = state.history.boosts.slice(0, 20);
      saveJSON("opm-history", state.history);
      renderActivity();
      toast(`Auto boost freed ${fmtBytes(freedBytes)}`, {
        kind: "good",
        body: "Memory usage was above 85% — working sets trimmed automatically.",
      });
    });
    T.event.listen("game-detected", (e) => {
      const p = e.payload || {};
      pushActivity({ icon: "warn", title: `${p.name || "A game"} launched`, sub: timeAgo(Date.now()) });
      if (state.page === "game") refreshGameData();
      else {
        updateGameBannerFromEvent(p.name);
      }
      toast(`${p.name || "Game"} detected`, {
        kind: "good",
        body: "Game Mode is active — your tweaks are applied.",
      });
    });
    T.event.listen("game-closed", (e) => {
      if (state.page === "game") refreshGameData();
      else updateGameBannerFromEvent(null);
    });
    T.event.listen("update-progress", (e) => onUpdateProgress(e.payload || {}));
    T.event.listen("update-installed", () => {
      $("#updateProgressLabel").textContent = "Installed — restarting Optimakerpro…";
      toast("Update installed", { kind: "good", body: "The app will restart now." });
    });
    T.event.listen("update-failed", (e) => {
      $("#updateProgressWrap").classList.add("hidden");
      $("#checkUpdatesBtn").classList.remove("busy");
      const note = $("#updateNote");
      note.textContent = (e.payload && e.payload.message) || "Update failed.";
      note.className = "update-note muted err";
    });
  }
}

function updateGameBannerFromEvent(name) {
  const pill = $("#gmPill");
  const pillText = $("#gmPillText");
  if (name) {
    pill.classList.add("on");
    pillText.textContent = "GAME MODE ON";
    $("#gmStatusText").textContent = `${name} is running — your tweaks are active.`;
    $("#boostGameBtn").classList.remove("hidden");
  } else {
    pill.classList.remove("on");
    pillText.textContent = "NO GAME RUNNING";
    $("#gmStatusText").textContent = "Detection is on — launch a game.";
    $("#boostGameBtn").classList.add("hidden");
  }
}

/* ============================================================
   Init
   ============================================================ */

async function init() {
  if (!isTauri) $("#demoBadge").classList.remove("hidden");

  try {
    wire();
  } catch (e) {
    console.error("wire failed", e);
  }

  try {
    await loadSettings();
  } catch (e) {
    console.error("settings failed", e);
  }

  let version = "1.0.0";
  try {
    const info = await invoke("get_app_info");
    version = info.version || version;
  } catch {
    /* keep fallback version */
  }
  $("#versionPill").textContent = `v${version}`;
  const about = $("#aboutInfo");
  if (about) {
    about.textContent = `Version ${version} · Windows (x86_64 & x86)`;
  }
  setUpdateStatus(`Current version: v${version}`);

  renderActivity();
  renderHistory();
  pollStats();
  setInterval(pollStats, 2500);

  // Quiet update check shortly after launch.
  setTimeout(() => {
    checkForUpdates(false);
  }, 4000);
}

init();
