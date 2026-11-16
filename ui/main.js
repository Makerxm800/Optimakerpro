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
  procTimer: null,
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

function toast(title, { body = "", kind = "", actions = [], sticky = false } = {}) {
  const wrap = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `
    <strong>${esc(title)}</strong>
    ${body ? `<p>${esc(body)}</p>` : ""}
    ${actions.length ? `<div class="toast-actions"></div>` : ""}
  `;
  const actionRow = el.querySelector(".toast-actions");
  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = `btn ${a.primary ? "btn-primary" : ""}`;
    btn.textContent = a.label;
    btn.addEventListener("click", () => {
      dismiss();
      a.cb && a.cb();
    });
    actionRow.appendChild(btn);
  });
  wrap.appendChild(el);

  function dismiss() {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 260);
  }

  if (!sticky && !actions.length) setTimeout(dismiss, 5000);
  else if (!sticky) setTimeout(dismiss, 9000);
  return dismiss;
}

/* ============================================================
   Demo mode (when opened in a plain browser, outside Tauri)
   ============================================================ */

const demoSettings = {
  realTimeProtection: true,
  autoMemoryBoost: true,
  autoCleanup: true,
  silentMode: false,
  cleanupIntervalHours: 12,
  launchOnStartup: false,
  reduceAnimations: false,
};

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
        { name: "chrome.exe", memory_bytes: 2_140_000_000 },
        { name: "msedge.exe", memory_bytes: 1_510_000_000 },
        { name: "code.exe", memory_bytes: 980_000_000 },
        { name: "discord.exe", memory_bytes: 640_000_000 },
        { name: "explorer.exe", memory_bytes: 310_000_000 },
        { name: "steam.exe", memory_bytes: 290_000_000 },
        { name: "spotify.exe", memory_bytes: 180_000_000 },
        { name: "notepad.exe", memory_bytes: 20_000_000 },
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
    case "list_quarantine":
      return [];
    case "check_for_updates":
      return { current_version: "1.0.0", available: false, version: null, notes: null, download_size: 0, message: "You're on the latest version. (preview data)" };
    case "reveal_quarantine":
      return null;
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
  protection: "Protection",
  settings: "Settings",
};

function setPage(page) {
  state.page = page;
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === `page-${page}`));
  $("#pageTitle").textContent = PAGE_TITLES[page] || "Optimakerpro";
  if (page === "performance") refreshPerformancePage();
  if (page === "protection") refreshQuarantine();
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
    realTimeProtection: "Real-Time Protection",
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
    list.innerHTML = `<li class="activity-empty">Nothing yet — cleanups, boosts and alerts will show up here.</li>`;
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
    // Re-scan quietly so the list shows what's left.
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
   Protection page
   ============================================================ */

async function refreshQuarantine() {
  let items = [];
  try {
    items = await invoke("list_quarantine");
  } catch {
    /* ignore */
  }
  const list = $("#quarList");
  if (!items.length) {
    list.innerHTML = `<li class="list-empty">Quarantine is empty.</li>`;
    return;
  }
  list.innerHTML = items
    .map(
      (q) => `
    <li data-id="${esc(q.id)}">
      <span class="act-icon warn"><svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg></span>
      <div class="quar-info"><strong>${esc(q.name)}</strong><span>${esc(q.original_path)} · ${esc(fmtBytes(q.size_bytes))} · ${esc(timeAgo(q.quarantined_at * 1000))}</span></div>
      <div class="quar-actions">
        <button class="btn btn-sm" data-act="restore">Restore</button>
        <button class="btn btn-sm btn-ghost-danger" data-act="delete">Delete</button>
      </div>
    </li>`
    )
    .join("");
  list.querySelectorAll("li[data-id]").forEach((li) => {
    const id = li.dataset.id;
    li.querySelector('[data-act="restore"]').addEventListener("click", async () => {
      try {
        await invoke("restore_quarantined", { id });
        toast("Restored", { kind: "good" });
        refreshQuarantine();
      } catch (e) {
        toast("Restore failed", { body: String(e), kind: "err" });
      }
    });
    li.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      try {
        await invoke("delete_quarantined", { id });
        toast("Deleted permanently", { kind: "good" });
        refreshQuarantine();
      } catch (e) {
        toast("Delete failed", { body: String(e), kind: "err" });
      }
    });
  });
}

function onThreatFound(payload) {
  pushActivity({ icon: "warn", title: `Suspicious file: ${payload.name}`, sub: timeAgo(Date.now()) });
  toast("Suspicious file detected", {
    kind: "warn",
    sticky: true,
    body: `${payload.name} (${fmtBytes(payload.sizeBytes)}) just appeared in a temp folder.`,
    actions: [
      {
        label: "Quarantine",
        primary: true,
        cb: async () => {
          try {
            await invoke("quarantine_file", { path: payload.path });
            toast("Moved to quarantine", { kind: "good", body: payload.name });
            if (state.page === "protection") refreshQuarantine();
          } catch (e) {
            toast("Couldn't quarantine", { body: String(e), kind: "err" });
          }
        },
      },
      { label: "Ignore", cb: () => {} },
    ],
  });
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

  // Toggles everywhere (dashboard tiles, protection hero, settings rows)
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

  // Cleanup
  $("#scanBtn").addEventListener("click", scanJunk);
  $("#cleanBtn").addEventListener("click", cleanSelected);
  $("#checkAll").addEventListener("change", (e) => {
    $$("#cleanList input[type=checkbox]").forEach((cb) => (cb.checked = e.target.checked));
    updateCleanSelection();
  });

  // Performance
  $("#boostBtn").addEventListener("click", boostMemory);

  // Protection
  $("#openQuarBtn").addEventListener("click", async () => {
    try {
      await invoke("reveal_quarantine");
    } catch (e) {
      toast("Couldn't open folder", { body: String(e), kind: "err" });
    }
  });

  // Settings
  $("#checkUpdatesBtn").addEventListener("click", () => checkForUpdates(true));
  $("#installUpdateBtn").addEventListener("click", installUpdate);

  // Window controls (Tauri only)
  if (isTauri) {
    const win = T.window.getCurrentWindow();
    $("#winMin").addEventListener("click", () => win.minimize());
    $("#winMax").addEventListener("click", () => win.toggleMaximize());
    $("#winClose").addEventListener("click", () => win.close());

    T.event.listen("clean-progress", (e) => {
      const { id } = e.payload || {};
      const row = $(`#cleanList .clean-row[data-id="${CSS.escape(id)}"]`);
      if (row) row.querySelector(".clean-state").innerHTML = `<span class="spinner"></span>`;
    });
    T.event.listen("threat-found", (e) => onThreatFound(e.payload || {}));
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

/* ============================================================
   Init
   ============================================================ */

async function init() {
  if (!isTauri) $("#demoBadge").classList.remove("hidden");
  wire();
  await loadSettings();

  try {
    const info = await invoke("get_app_info");
    $("#versionPill").textContent = `v${info.version}`;
    $("#aboutInfo").innerHTML =
      `<strong>Optimakerpro</strong> v${esc(info.version)}<br>` +
      `A fast, lightweight PC optimizer.<br>` +
      `Running on ${esc(info.os)} (${esc(info.arch)}).`;
    setUpdateStatus(`Current version: v${info.version}`);
  } catch {
    $("#versionPill").textContent = "v1.0.0";
  }

  renderActivity();
  renderHistory();
  pollStats();
  setInterval(pollStats, 2500);

  // Quiet update check shortly after launch.
  setTimeout(() => {
    if (isTauri) checkForUpdates(false);
  }, 4000);
}

init();
