import type { ComponentType } from "react";
import {
  IconClean,
  IconDashboard,
  IconMemory,
  IconSettings,
  IconShield,
  IconStartup,
  Logo,
} from "./ui";

export type PageId =
  | "dashboard"
  | "cleanup"
  | "memory"
  | "startup"
  | "protection"
  | "settings";

const NAV: { id: PageId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: IconDashboard },
  { id: "cleanup", label: "Deep Clean", icon: IconClean },
  { id: "memory", label: "Memory Boost", icon: IconMemory },
  { id: "startup", label: "Startup", icon: IconStartup },
  { id: "protection", label: "Protection", icon: IconShield },
  { id: "settings", label: "Settings", icon: IconSettings },
];

export function Sidebar({
  page,
  onNavigate,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
}) {
  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col gap-1 border-r border-white/[0.06] bg-ink-900/60 px-4 py-6 backdrop-blur-xl">
      <div className="mb-8 flex items-center gap-3 px-2">
        <Logo />
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-extrabold tracking-tight text-white">
              Taurie V2
            </span>
            <span className="rounded-md border border-cyan-glow/40 bg-cyan-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-widest text-cyan-300">
              Beta
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            PC Optimizer Premium
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = page === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-white">Premium Active</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          All optimization modules unlocked. This is a beta build — expect
          active refinements.
        </p>
      </div>
    </aside>
  );
}
