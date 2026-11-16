import { useEffect, useState } from "react";
import { getSystemStats, type SystemStats } from "../lib/backend";
import { Badge, Card, IconInfo, IconSettings, Logo } from "../components/ui";

export function Settings() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    getSystemStats().then(setStats);
  }, []);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      {/* About */}
      <Card>
        <div className="flex items-center gap-5">
          <Logo className="h-16 w-16" />
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Taurie V2
              </h1>
              <span className="rounded-md border border-cyan-glow/40 bg-cyan-500/10 px-2 py-px text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Beta
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Premium PC Optimizer — Windows & macOS · v0.9.0-beta
            </p>
          </div>
          <Badge tone="green">Premium</Badge>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-slate-400">
          Taurie V2 keeps your system fast and tidy with one-click smart scans,
          deep junk cleaning, memory boosting, startup management and
          real-time protection. Built with the Tauri 2 desktop framework —
          lightweight, native and private.
        </p>
      </Card>

      {/* System info */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <IconSettings className="h-5 w-5 text-brand-300" />
          <h2 className="text-base font-bold text-white">System Information</h2>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <InfoRow label="Operating System" value={stats ? `${stats.os} ${stats.os_version}` : "—"} />
          <InfoRow label="Architecture" value={stats?.architecture ?? "—"} />
          <InfoRow label="CPU" value={stats?.cpu_model ?? "—"} />
          <InfoRow label="Memory" value={stats ? `${(stats.memory_total_bytes / 1024**3).toFixed(1)} GB` : "—"} />
          <InfoRow label="Disk" value={stats ? `${(stats.disk_total_bytes / 1024**3).toFixed(0)} GB` : "—"} />
          <InfoRow label="Uptime" value={stats ? `${Math.floor(stats.uptime_seconds / 3600)}h ${Math.floor((stats.uptime_seconds % 3600) / 60)}m` : "—"} />
        </div>
      </Card>

      {/* Modules */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <IconInfo className="h-5 w-5 text-brand-300" />
          <h2 className="text-base font-bold text-white">Included Modules</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            "Smart Scan & Health Score",
            "Deep Junk Cleaning",
            "Memory Boost & Auto-Boost",
            "Startup Manager",
            "Real-Time Protection",
            "Scheduled Maintenance",
            "Silent / Game Mode",
            "Cross-platform (Windows · macOS)",
          ].map((m) => (
            <div
              key={m}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span className="text-sm font-medium text-slate-200">{m}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Privacy */}
      <Card className="flex items-start gap-3">
        <IconInfo className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-white">Privacy first</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            All scanning and optimization happens locally on your device.
            Taurie V2 does not collect or upload your personal files or system
            statistics.
          </p>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-200">{value}</span>
    </div>
  );
}
