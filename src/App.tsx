import { useCallback, useRef, useState } from "react";
import { Sidebar, type PageId } from "./components/Sidebar";
import { Dashboard, type ActivityEntry, type Settings } from "./pages/Dashboard";
import { Cleanup } from "./pages/Cleanup";
import { Memory } from "./pages/Memory";
import { Startup } from "./pages/Startup";
import { Protection } from "./pages/Protection";
import { Settings as SettingsPage } from "./pages/Settings";
import { useLocalToggle, useLocalValue } from "./lib/store";
import { formatBytes } from "./lib/format";

const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "System status at a glance" },
  cleanup: { title: "Deep Clean", subtitle: "Reclaim disk space safely" },
  memory: { title: "Memory Boost", subtitle: "Keep RAM lean and responsive" },
  startup: { title: "Startup", subtitle: "Control what launches with your PC" },
  protection: { title: "Protection", subtitle: "Guards, automation and schedules" },
  settings: { title: "Settings", subtitle: "About and system information" },
};

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");

  const [realtime, setRealtime] = useLocalToggle("taurie.realtime", true);
  const [autoBoost, setAutoBoost] = useLocalToggle("taurie.autoBoost", true);
  const [silentMode, setSilentMode] = useLocalToggle("taurie.silentMode", false);
  const [autoCleanup, setAutoCleanup] = useLocalToggle("taurie.autoCleanup", true);
  const [maintenance, setMaintenance] = useLocalToggle("taurie.maintenance", false);
  const [frequency, setFrequency] = useLocalValue<"daily" | "weekly">(
    "taurie.frequency",
    "weekly"
  );

  const settings: Settings = {
    realtime,
    autoBoost,
    silentMode,
    autoCleanup,
    maintenance,
    frequency,
  };
  const setSettings = (patch: Partial<Settings>) => {
    if ("realtime" in patch) setRealtime(patch.realtime!);
    if ("autoBoost" in patch) setAutoBoost(patch.autoBoost!);
    if ("silentMode" in patch) setSilentMode(patch.silentMode!);
    if ("autoCleanup" in patch) setAutoCleanup(patch.autoCleanup!);
    if ("maintenance" in patch) setMaintenance(patch.maintenance!);
    if ("frequency" in patch) setFrequency(patch.frequency!);
  };

  const idRef = useRef(2);
  const [activity, setActivity] = useState<ActivityEntry[]>([
    {
      id: 1,
      text: "Welcome to Taurie V2 (Beta) — your premium optimizer is ready.",
      tone: "info",
      time: "Just now",
    },
  ]);
  const appendActivity = useCallback((text: string, tone: ActivityEntry["tone"] = "ok") => {
    setActivity((prev) =>
      [
        {
          id: idRef.current++,
          text,
          tone,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ].slice(0, 30)
    );
  }, []);

  const meta = PAGE_META[page];

  return (
    <div className="app-bg flex h-screen w-screen overflow-hidden text-slate-200">
      <Sidebar page={page} onNavigate={setPage} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-ink-900/40 px-7 py-4 backdrop-blur-xl">
          <div>
            <h1 className="text-lg font-bold text-white">{meta.title}</h1>
            <p className="text-xs text-slate-500">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-300">
                All systems secure
              </span>
            </span>
            <span className="rounded-xl border border-cyan-glow/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
              Beta
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-hidden px-7 py-6">
          {page === "dashboard" && (
            <Dashboard
              settings={settings}
              setSettings={setSettings}
              onNavigate={setPage}
              activity={activity}
              appendActivity={appendActivity}
            />
          )}
          {page === "cleanup" && (
            <Cleanup
              onCleaned={(bytes, count) =>
                appendActivity(
                  `Deep clean finished — freed ${formatBytes(bytes)} from ${count} item(s).`,
                  "ok"
                )
              }
            />
          )}
          {page === "memory" && (
            <Memory
              autoBoost={autoBoost}
              onToggleAutoBoost={setAutoBoost}
              onBoosted={(freed) =>
                appendActivity(`Memory boost freed ${formatBytes(freed)}.`, "ok")
              }
            />
          )}
          {page === "startup" && (
            <Startup onMessage={(text) => appendActivity(text, "info")} />
          )}
          {page === "protection" && (
            <Protection
              settings={settings}
              setSettings={setSettings}
              onMessage={(text) => appendActivity(text, "info")}
            />
          )}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
