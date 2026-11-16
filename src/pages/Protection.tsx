import { useState } from "react";
import { setSchedule } from "../lib/backend";
import {
  Badge,
  Card,
  FeatureToggle,
  IconCheck,
  IconInfo,
  IconShield,
  IconStartup,
  IconSpark,
  Toggle,
} from "../components/ui";
import type { Settings } from "./Dashboard";

export function Protection({
  settings,
  setSettings,
  onMessage,
}: {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  onMessage: (text: string) => void;
}) {
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);

  const saveSchedule = async () => {
    setScheduleMsg(null);
    const res = await setSchedule(settings.maintenance, settings.frequency);
    setScheduleMsg(res.message);
    onMessage(
      settings.maintenance
        ? `Maintenance schedule set to ${settings.frequency}.`
        : "Maintenance schedule removed."
    );
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <Card className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
            <IconShield className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-white">Protection</h1>
            <p className="text-sm text-slate-400">
              Real-time guards, automation and schedules for a healthy system
            </p>
          </div>
        </div>
        <Badge tone={settings.realtime ? "green" : "slate"}>
          {settings.realtime ? "Active" : "Off"}
        </Badge>
      </Card>

      {/* Core toggles */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <IconShield className="h-5 w-5 text-brand-300" />
          <h2 className="text-base font-bold text-white">Guards</h2>
        </div>
        <div className="flex flex-col gap-3">
          <FeatureToggle
            icon={<IconShield className="h-5 w-5" />}
            title="Real-Time Protection"
            description="Watches for junk buildup and performance drains as you use your PC, and cleans them on the fly."
            checked={settings.realtime}
            onChange={(v) => setSettings({ realtime: v })}
          />
          <FeatureToggle
            icon={<IconSpark className="h-5 w-5" />}
            title="Auto Memory Boost"
            description="Releases standby memory automatically whenever usage climbs past 70%."
            checked={settings.autoBoost}
            onChange={(v) => setSettings({ autoBoost: v })}
          />
          <FeatureToggle
            icon={<IconStartup className="h-5 w-5" />}
            title="Auto Cleanup"
            description="Runs periodic junk sweeps during your idle maintenance window."
            checked={settings.autoCleanup}
            onChange={(v) => setSettings({ autoCleanup: v })}
          />
          <FeatureToggle
            icon={<IconInfo className="h-5 w-5" />}
            title="Silent / Game Mode"
            description="Pauses scans, popups and background activity while you work or game."
            checked={settings.silentMode}
            onChange={(v) => setSettings({ silentMode: v })}
            accent="cyan"
          />
        </div>
      </Card>

      {/* Scheduled maintenance */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <IconStartup className="h-5 w-5 text-brand-300" />
          <h2 className="text-base font-bold text-white">Scheduled Maintenance</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Automatic maintenance
            </p>
            <p className="text-xs text-slate-400">
              Schedules a full optimization pass (scan, clean, boost) on a
              recurring basis.
            </p>
          </div>
          <Toggle
            checked={settings.maintenance}
            onChange={(v) => setSettings({ maintenance: v })}
          />
        </div>
        {settings.maintenance && (
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 animate-fade-in">
            <label className="mb-2 block text-xs font-semibold text-slate-400">
              Frequency
            </label>
            <div className="flex gap-2">
              {(["daily", "weekly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSettings({ frequency: f })}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${
                    settings.frequency === f
                      ? "bg-brand-500 text-white shadow-[0_0_18px_rgba(124,92,255,0.45)]"
                      : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {f === "daily" ? "Every day" : "Every week"}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button className="btn-primary" onClick={saveSchedule}>
                <IconCheck className="h-4 w-4" />
                Save Schedule
              </button>
              {scheduleMsg && (
                <span className="text-xs text-slate-400">{scheduleMsg}</span>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="flex items-start gap-3">
        <IconInfo className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-white">Beta notice</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Taurie V2 is in active beta. Real-time guards and schedules run
            locally on your machine — no telemetry is uploaded. Toggles are
            saved on this device.
          </p>
        </div>
      </Card>
    </div>
  );
}
