import type { ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Icons                                                               *
 * ------------------------------------------------------------------ */

type IconProps = { className?: string };

const svg = (paths: ReactNode) =>
  function Icon({ className = "h-5 w-5" }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };

export const IconDashboard = svg(
  <>
    <rect x="3" y="3" width="7" height="9" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="12" width="7" height="9" rx="2" />
    <rect x="3" y="16" width="7" height="5" rx="2" />
  </>
);

export const IconClean = svg(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>
);

export const IconMemory = svg(
  <>
    <rect x="2" y="7" width="20" height="12" rx="2" />
    <path d="M6 18v2" />
    <path d="M10 18v2" />
    <path d="M14 18v2" />
    <path d="M18 18v2" />
    <path d="M7 12h2M11 12h2M15 12h2" />
  </>
);

export const IconStartup = svg(
  <>
    <path d="M12 2v10" />
    <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    <path d="M9 12h6" />
    <circle cx="12" cy="17" r="3.2" />
  </>
);

export const IconShield = svg(
  <>
    <path d="M12 2 4 5v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V5l-8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </>
);

export const IconSettings = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </>
);

export const IconSpark = svg(
  <>
    <path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2L12 2Z" />
    <path d="M19 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
  </>
);

export const IconScan = svg(
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M3 12h18" />
  </>
);

export const IconRocket = svg(
  <>
    <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0Z" />
    <path d="M12 15l-3-3a22 22 0 0 1 8-10c2 0 4 2 4 4a22 22 0 0 1-10 8Z" />
    <path d="M9 12H4s.5-2.5 2-4 5 0 5 0" />
    <path d="M12 15v5s2.5-.5 4-2 0-5 0-5" />
  </>
);

export const IconTrash = svg(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </>
);

export const IconCheck = svg(<path d="M20 6 9 17l-5-5" />);

export const IconInfo = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </>
);

export const IconActivity = svg(
  <path d="M3 12h4l2 7 4-14 2 7h6" />
);

/* ------------------------------------------------------------------ *
 * Logo                                                               *
 * ------------------------------------------------------------------ */

export function Logo({ className = "h-9 w-9" }: IconProps) {
  return (
    <img
      src="/taurie-logo.png"
      alt="Taurie V2"
      className={className}
      draggable={false}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Shared UI primitives                                                *
 * ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-40 ${
        checked
          ? "bg-brand-500 shadow-[0_0_16px_rgba(124,92,255,0.55)]"
          : "bg-white/15"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-300 ${
          checked ? "translate-x-5.5" : "translate-x-0.5"
        }`}
        style={{ height: "1.125rem", width: "1.125rem" }}
      />
    </button>
  );
}

export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "cyan" | "green" | "amber" | "slate";
}) {
  const tones = {
    brand: "border-brand-400/40 bg-brand-500/15 text-brand-200",
    cyan: "border-cyan-glow/40 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    slate: "border-white/10 bg-white/[0.06] text-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function ProgressBar({
  percent,
  tone = "brand",
}: {
  percent: number;
  tone?: "brand" | "cyan" | "green" | "amber";
}) {
  const tones = {
    brand: "from-brand-400 to-brand-600",
    cyan: "from-cyan-glow to-brand-500",
    green: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-orange-500",
  };
  return (
    <div className="stat-bar">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${tones[tone]} transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/** Animated circular health ring. */
export function ScoreRing({
  value,
  size = 168,
  label = "Health Score",
  sub,
}: {
  value: number;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={10}
          stroke="rgba(255,255,255,0.08)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          stroke="url(#scoreGrad)"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#7c5cff" />
            <stop offset="100%" stopColor="#5a35dc" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-extrabold text-white">{Math.round(value)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {sub && <span className="mt-1 text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

export function FeatureToggle({
  icon,
  title,
  description,
  checked,
  onChange,
  accent = "brand",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: "brand" | "cyan" | "green" | "amber";
}) {
  const accents = {
    brand: "text-brand-300 ring-brand-400/25 bg-brand-500/10",
    cyan: "text-cyan-300 ring-cyan-glow/25 bg-cyan-500/10",
    green: "text-emerald-300 ring-emerald-400/25 bg-emerald-500/10",
    amber: "text-amber-300 ring-amber-400/25 bg-amber-500/10",
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${accents[accent]}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="truncate text-xs text-slate-400">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
