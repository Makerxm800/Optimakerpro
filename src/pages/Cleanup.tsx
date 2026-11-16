import { useState } from "react";
import { cleanJunk, getJunkReport, type JunkItem } from "../lib/backend";
import { formatBytes } from "../lib/format";
import {
  Badge,
  Card,
  IconCheck,
  IconClean,
  IconInfo,
  IconScan,
  IconTrash,
  ProgressBar,
} from "../components/ui";

export function Cleanup({
  onCleaned,
}: {
  onCleaned: (bytes: number, count: number) => void;
}) {
  const [items, setItems] = useState<JunkItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [cleanPct, setCleanPct] = useState(0);

  const scan = async () => {
    setScanning(true);
    setScanPct(0);
    setResult(null);
    setSelected(new Set());
    for (let p = 5; p <= 100; p += 15) {
      setScanPct(p);
      await new Promise((r) => setTimeout(r, 150));
    }
    const report = await getJunkReport();
    setItems(report.items);
    setTotal(report.total_bytes);
    setScanning(false);
    setScanPct(100);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clean = async (ids: string[]) => {
    if (!ids.length || cleaning) return;
    setCleaning(true);
    setCleanPct(0);
    setResult(null);
    for (let p = 10; p <= 100; p += 20) {
      setCleanPct(p);
      await new Promise((r) => setTimeout(r, 140));
    }
    const res = await cleanJunk(ids);
    setCleanPct(100);
    const removedSize = items
      ?.filter((i) => ids.includes(i.id))
      .reduce((s, i) => s + i.size_bytes, 0);
    setResult(
      `Cleaned ${res.removed_files} item(s) — freed ${formatBytes(
        removedSize || res.removed_bytes
      )}.`
    );
    setCleaning(false);
    onCleaned(removedSize || res.removed_bytes, res.removed_files);
    // refresh list
    if (items) {
      const report = await getJunkReport();
      setItems(report.items);
      setTotal(report.total_bytes);
    }
  };

  const allSelected =
    !!items && items.length > 0 && items.every((i) => selected.has(i.id));

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      {/* Summary header */}
      <Card className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
            <IconClean className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-white">Deep Clean</h1>
            <p className="text-sm text-slate-400">
              {items
                ? `${items.length} safe areas found — ${formatBytes(total)} reclaimable`
                : "Scan your system to find reclaimable space"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={scan} disabled={scanning}>
            <IconScan className="h-4 w-4" />
            {scanning ? `Scanning ${scanPct}%` : items ? "Rescan" : "Start Scan"}
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              clean(
                allSelected ? items!.map((i) => i.id) : [...selected]
              )
            }
            disabled={cleaning || !items || selected.size === 0}
          >
            <IconTrash className="h-4 w-4" />
            {cleaning ? `Cleaning ${cleanPct}%` : `Clean ${selected.size || "All"}`}
          </button>
        </div>
      </Card>

      {scanning && (
        <div className="glass p-5">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Scanning safe locations…</span>
            <span className="font-semibold text-cyan-300">{scanPct}%</span>
          </div>
          <ProgressBar percent={scanPct} tone="cyan" />
        </div>
      )}

      {result && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] p-4 animate-fade-in">
          <IconCheck className="h-5 w-5 shrink-0 text-emerald-300" />
          <p className="text-sm text-emerald-200">{result}</p>
        </div>
      )}

      {/* Items */}
      {items ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              Junk Areas ({items.length})
            </h2>
            <Badge tone="slate">
              {selected.size} selected · {formatBytes(
                items
                  .filter((i) => selected.has(i.id))
                  .reduce((s, i) => s + i.size_bytes, 0)
              )}
            </Badge>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-4 py-3.5 transition-colors hover:bg-white/[0.03]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="h-4.5 w-4.5 accent-brand-500"
                  style={{ height: "1.125rem", width: "1.125rem" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {item.name}
                    </span>
                    {item.safe && (
                      <Badge tone="green">
                        <IconCheck className="h-3 w-3" />
                        Safe
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {item.description}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-600">
                    {item.path}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-brand-300">
                  {formatBytes(item.size_bytes)}
                </span>
              </label>
            ))}
            {items.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                No junk found — your system is already clean.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <IconScan className="h-10 w-10 text-slate-600" />
          <p className="max-w-xs text-sm text-slate-400">
            Run a scan to inspect temporary files, caches and leftovers that
            slow your system down.
          </p>
        </Card>
      )}

      {/* Safety note */}
      <Card className="flex items-start gap-3">
        <IconInfo className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-white">
            Safe-cleaning guarantee
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Taurie only ever removes files from known volatile locations such as
            OS temp folders and caches — documents, photos and personal data are
            never touched. Deletion is verified against the scan roots before
            anything is removed.
          </p>
        </div>
      </Card>
    </div>
  );
}
