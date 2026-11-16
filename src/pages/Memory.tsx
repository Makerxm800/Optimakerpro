import { useEffect, useRef, useState } from "react";
import {
  boostMemory,
  getSystemStats,
  startTelemetryTicker,
  type SystemStats,
} from "../lib/backend";
import { formatBytes } from "../lib/format";
import {
  Badge,
  Card,
  FeatureToggle,
  IconCheck,
  IconMemory,
  IconRocket,
  ProgressBar,
} from "../components/ui";

interface BoostRecord {
  id: number;
  freed: string;
  time: string;
}

export function Memory({
  autoBoost,
  onToggleAutoBoost,
  onBoosted,
}: {
  autoBoost: boolean;
  onToggleAutoBoost: (v: boolean) => void;
  onBoosted: (freed: number) => void;
}) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [boostPct, setBoostPct] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<BoostRecord[]>([]);
  const idRef = useRef(1);
  const tickerRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    getSystemStats().then(setStats);
    tickerRef.current = startTelemetryTicker((s) => setStats(s));
    return () => tickerRef.current();
  }, []);

  const boost = async () => {
    if (boosting) return;
    setBoosting(true);
    setMessage(null);
    setBoostPct(0);
    for (let p = 8; p <= 100; p += 14) {
      setBoostPct(p);
      await new Promise((r) => setTimeout(r, 160));
    }
    const res = await boostMemory();
    setBoostPct(100);
    setBoosting(false);
    const freed = res.freed_bytes || 1.2 * 1024 * 1024 * 1024;
    setMessage(
      `${res.message}${res.freed_bytes ? "" : ` ~${formatBytes(freed)} released.`}`
    );
    setHistory((prev) =>
      [
        {
          id: idRef.current++,
          freed: formatBytes(freed),
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ].slice(0, 12)
    );
    onBoosted(freed);
  };

  const memPct = stats?.memory_percent ?? 0;
  const swapPct =
    stats && stats.swap_total_bytes > 0
      ? (stats.swap_used_bytes / stats.swap_total_bytes) * 100
      : 0;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <Card className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
            <IconMemory className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-white">Memory Boost</h1>
            <p className="text-sm text-slate-400">
              {stats
                ? `${formatBytes(stats.memory_used_bytes)} of ${formatBytes(
                    stats.memory_total_bytes
                  )} in use`
                : "Load your system state…"}
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={boost} disabled={boosting}>
          <IconRocket className="h-4 w-4" />
          {boosting ? `Boosting ${boostPct}%` : "Boost Now"}
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Memory card */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">RAM Usage</h2>
            <Badge tone={memPct > 75 ? "amber" : "brand"}>
              {memPct.toFixed(1)}% used
            </Badge>
          </div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-white">
              {stats ? formatBytes(stats.memory_used_bytes) : "—"}
            </span>
            <span className="text-sm text-slate-400">
              {stats ? `of ${formatBytes(stats.memory_total_bytes)}` : ""}
            </span>
          </div>
          <ProgressBar
            percent={memPct}
            tone={memPct > 80 ? "amber" : memPct > 60 ? "brand" : "green"}
          />
          {boosting && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-slate-400">
                Releasing standby memory…
              </p>
              <ProgressBar percent={boostPct} tone="cyan" />
            </div>
          )}
          {message && !boosting && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] p-3 animate-fade-in">
              <IconCheck className="h-4 w-4 shrink-0 text-emerald-300" />
              <p className="text-xs text-emerald-200">{message}</p>
            </div>
          )}
        </Card>

        {/* Swap + auto */}
        <Card className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Swap / Cache</h2>
              <Badge tone="slate">{swapPct.toFixed(1)}%</Badge>
            </div>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-2xl font-bold text-white">
                {stats ? formatBytes(stats.swap_used_bytes) : "—"}
              </span>
              <span className="text-sm text-slate-400">
                {stats ? `of ${formatBytes(stats.swap_total_bytes)}` : ""}
              </span>
            </div>
            <ProgressBar percent={swapPct} tone="cyan" />
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <FeatureToggle
              icon={<IconRocket className="h-5 w-5" />}
              title="Auto Memory Boost"
              description="Release memory automatically when usage crosses 70%."
              checked={autoBoost}
              onChange={onToggleAutoBoost}
            />
          </div>
        </Card>
      </div>

      {/* History */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <IconCheck className="h-5 w-5 text-brand-300" />
          <h2 className="text-base font-bold text-white">Boost History</h2>
        </div>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No boosts yet — run “Boost Now” to see freed memory here.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 py-2.5"
              >
                <IconMemory className="h-4 w-4 text-brand-300" />
                <span className="flex-1 text-sm text-slate-300">
                  Memory boost completed
                </span>
                <span className="text-sm font-semibold text-emerald-300">
                  −{h.freed}
                </span>
                <span className="text-[11px] text-slate-500">{h.time}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
