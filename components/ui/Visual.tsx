import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function ChoiceChip({
  selected,
  children,
  className,
  ...rest
}: { selected?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "focus-ring min-h-10 rounded-[var(--nx-radius-sm)] border px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "border-[color-mix(in_srgb,var(--nx-primary)_40%,var(--nx-border))] bg-[color-mix(in_srgb,var(--nx-primary)_12%,transparent)] text-ink"
          : "border-line bg-elevated text-[var(--nx-text-secondary)] hover:text-ink",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ScoreMark({ value, label = "Score" }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const tone = pct >= 80 ? "var(--nx-success)" : pct >= 60 ? "var(--nx-warning)" : "var(--nx-danger)";
  const status = pct >= 80 ? "Healthy" : pct >= 60 ? "Needs attention" : "Critical";
  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${label} ${pct} of 100, ${status}`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--nx-border-strong)" strokeWidth="6" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="6"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="50" textAnchor="middle" fontSize="20" fontWeight="650" fill="var(--nx-text)">
          {pct}
        </text>
      </svg>
      <div>
        <p className="nx-label">{label}</p>
        <p className="mt-1 text-sm font-medium text-ink">{status}</p>
        <p className="text-xs text-muted">Out of 100</p>
      </div>
    </div>
  );
}

export function Sparkline({ values, label }: { values: number[]; label?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 26 - ((value - min) / span) * 22;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,32 ${points} 100,32`;
  return (
    <svg
      viewBox="0 0 100 32"
      className="h-10 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={label || "Trend"}
    >
      <polygon fill="color-mix(in srgb, var(--nx-primary) 12%, transparent)" points={area} />
      <polyline fill="none" stroke="var(--nx-primary)" strokeWidth="2" points={points} />
    </svg>
  );
}

export function ActivityRow({
  icon,
  title,
  meta,
  status,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  status?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-elevated text-[var(--nx-text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{title}</p>
        {meta ? <p className="truncate text-xs text-muted">{meta}</p> : null}
      </div>
      {status}
    </li>
  );
}
