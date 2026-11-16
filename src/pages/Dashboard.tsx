import { useEffect, useRef, useState } from "react";
import {
  boostMemory,
  getJunkReport,
  getSystemStats,
  listStartupApps,
  startTelemetryTicker,
  type SystemStats,
} from "../lib/backend";
import { formatBootTime, formatBytes, formatUptime } from "../lib/format";
import {
  Card,
  FeatureToggle,
  IconActivity,
  IconClean,
  IconInfo,
  IconMemory,
  IconRocket,
  IconScan,
  IconShield,
  IconSpark,
  ProgressBar,
  ScoreRing,
} from "../components/ui";
import type { PageId } from "../components/Sidebar";

export interface Settings {
  realtime: boolean;
  autoBoost: boolean;
  silentMode: boolean;
  autoCleanup: boolean;
  maintenance: boolean;
  frequency: "daily" | "weekly";
}

export interface ActivityEntry {
  id: number;
  text: string;
  tone: "ok" | "info" | "warn";
  time: string;
}

export function Dashboard({
  settings,
  setSettings,
  onNavigate,
  activity,
  appendActivity,
}: {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  onNavigate: (p: PageId) => void;
  activity: ActivityEntry[];
  appendActivity: (text: string, tone?: ActivityEntry["tone"]) => void;
}) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const tickerRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    getSystemStats().then(setStats);
    tickerRef.current = startTelemetryTicker((s) => setStats(s));
    return () => tickerRef.current();
  }, []);

  const runSmartScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanPct(0);
    appendActivity("Smart Scan started — inspecting system health…", "info");
    for (let p = 8; p <= 100; p += 12) {
      setScanPct(p);
      await new Promise((r) => setTimeout(r, 240));
    }
    const [junk, startup] = await Promise.all([getJunkReport(), listStartupApps()]);
    const enabledStartup = startup.filter((a) => a.enabled).length;
    setScanPct(100);
    setScanning(false);
    appendActivity(
      `Smart Scan complete — ${junk.item_count} junk areas, ${enabledStartup} startup apps active.`,
      "ok"
    );
    appendActivity(
      junk.total_bytes > 0
        ? `Reclaimable space detected: ${formatBytes(junk.total_bytes)}.`
        : "No significant junk found. System is tidy.",
      junk.total_bytes > 0 ? "warn" : "ok"
    );
  };

  const boost = async () => {
    const res = await boostMemory();
    appendActivity(res.message, "ok");
  };

  const health = stats
    ? Math.round(
        100 -
          stats.disk_percent * 0.4 -
          stats.memory_percent * 0.25 -
          Math.min(stats.cpu_percent, 90) * 0.1
      )
    : 82;

  const statusText =
    health >= 85
      ? "Excellent — your system is in top shape"
      : health >= 65
        ? "Fair — a quick optimization will help"
        : "Attention needed — run a scan to improve performance";

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      {/* Hero */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-8 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-7 shadow-card animate-fade-in">
        <ScoreRing
          value={health}
          sub={scanning ? `Scanning ${scanPct}%` : undefined}
        />
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              System Overview
            </h1>
            <span className="rounded-md border border-cyan-glow/40 bg-cyan-500/10 px-2 py-px text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              Beta
            </span>
          </div>
          <p className="mb-5 max-w-md text-sm text-slate-400">{statusText}</p>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              onClick={runSmartScan}
              disabled={scanning}
            >
              <IconScan className="h-4 w-4" />
              {scanning ? `Scanning… ${scanPct}%` : "Run Smart Scan"}
            </button>
            <button className="btn-ghost" onClick={boost} disabled={scanning}>
              <IconRocket className="h-4 w-4" />
              Boost Memory
            </button>
          </div>

          {scanning && (
            <div className="mt-5 max-w-xs">
              <ProgressBar percent={scanPct} tone="cyan" />
            </div>
          )}
        </div>
        <div className="hidden shrink-0 flex-col items-center gap-2 rounded-2xl bg-brand-gradient/10 p-5 ring-1 ring-brand-400/20 lg:flex">
          <IconSpark className="h-7 w-7 text-brand-300" />
          <span className="text-xs font-semibold text-brand-200">
            Premium Engine
          </span>
          <span className="text-[11px] text-slate-400">One-click optimization</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="CPU Load"
          icon={<IconActivity className="h-5 w-5" />}
          value={`${stats?.cpu_percent.toFixed(1) ?? "0"}%`}
          detail={stats?.cpu_model ?? "—"}
          percent={stats?.cpu_percent ?? 0}
          tone={(stats?.cpu_percent ?? 0) > 75 ? "amber" : "cyan"}
        />
        <StatCard
          title="Memory"
          icon={<IconMemory className="h-5 w-5" />}
          value={
            stats
              ? `${formatBytes(stats.memory_used_bytes, 1)} / ${formatBytes(stats.memory_total_bytes)}`
              : "—"
          }
          detail={`${stats?.memory_percent.toFixed(1)}% in use`}
          percent={stats?.memory_percent ?? 0}
          tone={(stats?.memory_percent ?? 0) > 75 ? "amber" : "brand"}
        />
        <StatCard
          title="Disk"
          icon={<IconClean className="h-5 w-5" />}
          value={
            stats
              ? `${formatBytes(stats.disk_used_bytes)} / ${formatBytes(stats.disk_total_bytes)}`
              : "—"
          }
          detail={`${stats?.disk_percent.toFixed(1)}% used`}
          percent={stats?.disk_percent ?? 0}
          tone={(stats?.disk_percent ?? 0) > 80 ? "amber" : "green"}
        />
        <StatCard
          title="Uptime"
          icon={<IconRocket className="h-5 w-5" />}
          value={stats ? formatUptime(stats.uptime_seconds) : "—"}
          detail={stats ? `Boot: ${formatBootTime(stats.boot_time_seconds)}` : ""}
          percent={stats?.cpu_percent ?? 0}
          tone="slate"
          hideBar
        />
      </div>

      {/* Quick toggles */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <IconSpark className="h-5 w-5 text-brand-300" />
          <h2 className="text-base font-bold text-white">Feature Quick Access</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <FeatureToggle
            icon={<IconShield className="h-5 w-5" />}
            title="Real-Time Protection"
            description="Continuously guards against junk buildup and performance drains."
            checked={settings.realtime}
            onChange={(v) => {
              setSettings({ realtime: v });
              appendActivity(`Real-time protection ${v ? "enabled" : "disabled"}.`, "info");
            }}
          />
          <FeatureToggle
            icon={<IconMemory className="h-5 w-5" />}
            title="Auto Memory Boost"
            description="Releases standby memory automatically when usage climbs."
            checked={settings.autoBoost}
            onChange={(v) => setSettings({ autoBoost: v })}
          />
          <FeatureToggle
            icon={<IconScan className="h-5 w-5" />}
            title="Auto Cleanup"
            description="Schedules periodic junk sweeps on your maintenance window."
            checked={settings.autoCleanup}
            onChange={(v) => setSettings({ autoCleanup: v })}
          />
          <FeatureToggle
            icon={<IconActivity className="h-5 w-5" />}
            title="Silent / Game Mode"
            description="Pauses background scans and notifications while you work or game."
            checked={settings.silentMode}
            onChange={(v) => setSettings({ silentMode: v })}
          />
        </div>
      </Card>

      {/* Activity */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconInfo className="h-5 w-5 text-brand-300" />
            <h2 className="text-base font-bold text-white">Recent Activity</h2>
          </div>
          <button
            className="text-xs font-semibold text-brand-300 hover:text-brand-200"
            onClick={() => onNavigate("protection")}
          >
            Protect settings →
          </button>
        </div>
        <ActivityLog entries={activity} />
      </Card>
    </div>
  );
}

function StatCard({
  title,
  icon,
  value,
  detail,
  percent,
  tone,
  hideBar,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  detail: string;
  percent: number;
  tone: "brand" | "cyan" | "green" | "amber" | "slate";
  hideBar?: boolean;
}) {
  return (
    <div className="glass p-5 animate-fade-in">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-brand-300 ring-1 ring-white/10">
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-0.5 truncate text-xs text-slate-400">{detail}</p>
      {!hideBar && (
        <div className="mt-3">
          <ProgressBar percent={percent} tone={tone === "slate" ? "brand" : tone} />
        </div>
      )}
    </div>
  );
}

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  const toneDot = {
    ok: "bg-emerald-400",
    info: "bg-brand-400",
    warn: "bg-amber-400",
  };

  return (
    <div className="flex flex-col divide-y divide-white/[0.05]">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 py-2.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot[e.tone]}`} />
          <span className="flex-1 text-sm text-slate-300">{e.text}</span>
          <span className="text-[11px] text-slate-500">{e.time}</span>
        </div>
      ))}
    </div>
  );
}
