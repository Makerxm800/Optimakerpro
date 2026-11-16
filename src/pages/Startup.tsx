import { useEffect, useState } from "react";
import {
  listStartupApps,
  setStartupAppState,
  type StartupApp,
} from "../lib/backend";
import {
  Badge,
  Card,
  IconCheck,
  IconInfo,
  IconStartup,
  Toggle,
} from "../components/ui";

export function Startup({
  onMessage,
}: {
  onMessage: (text: string) => void;
}) {
  const [apps, setApps] = useState<StartupApp[] | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const refresh = async () => {
    const list = await listStartupApps();
    setApps(list);
    return list;
  };

  useEffect(() => {
    refresh();
  }, []);

  const toggle = async (app: StartupApp) => {
    setToggling(app.name);
    const next = !app.enabled;
    setApps((prev) =>
      prev
        ? prev.map((a) => (a.name === app.name ? { ...a, enabled: next } : a))
        : prev
    );
    const res = await setStartupAppState(app.name, app.path, next);
    setToggling(null);
    onMessage(
      `${app.name}: ${res.ok ? (next ? "enabled" : "disabled") : "failed"} at startup.`
    );
    // resync in case the OS disagreed
    refresh();
  };

  const enabledCount = apps?.filter((a) => a.enabled).length ?? 0;
  const allCount = apps?.length ?? 0;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <Card className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
            <IconStartup className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-white">Startup Manager</h1>
            <p className="text-sm text-slate-400">
              {apps
                ? `${enabledCount} of ${allCount} apps launch with your system`
                : "Loading startup apps…"}
            </p>
          </div>
        </div>
        {apps && (
          <div className="flex gap-2">
            <Badge tone="green">
              <IconCheck className="h-3 w-3" />
              {allCount - enabledCount} disabled
            </Badge>
            <Badge tone="amber">{enabledCount} enabled</Badge>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Startup Apps</h2>
          <span className="text-xs text-slate-500">
            Toggles take effect immediately
          </span>
        </div>
        {apps === null ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Loading…
          </p>
        ) : apps.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No startup items detected on this system.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {apps.map((app) => (
              <div
                key={app.name + app.source}
                className="flex items-center gap-4 py-3.5"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    app.enabled
                      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25"
                      : "bg-white/[0.05] text-slate-500 ring-1 ring-white/10"
                  }`}
                >
                  {app.enabled ? "●" : "○"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">
                    {app.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {app.command || app.path}
                  </p>
                </div>
                <Badge tone="slate">{app.source}</Badge>
                <button
                  onClick={() => toggle(app)}
                  disabled={toggling === app.name}
                  title={
                    toggling === app.name
                      ? "Working…"
                      : app.enabled
                        ? "Disable"
                        : "Enable"
                  }
                >
                  <Toggle
                    checked={app.enabled}
                    disabled={toggling === app.name}
                    onChange={() => toggle(app)}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex items-start gap-3">
        <IconInfo className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-white">
            What does this do?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Disabling unnecessary startup apps shortens boot time and frees
            resources for what you actually use. Windows entries are managed in
            the registry; macOS items are moved out of LaunchAgents (a backup
            is kept so you can re-enable them later).
          </p>
        </div>
      </Card>
    </div>
  );
}
