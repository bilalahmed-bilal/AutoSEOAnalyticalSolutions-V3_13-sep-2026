import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("nx-card p-5 sm:p-6", className)} {...rest} />;
}

export function MetricCard({
  label,
  value,
  hint,
  trend,
  flush = false,
  className,
}: {
  label: string;
  value: unknown;
  hint?: string;
  trend?: number | null;
  flush?: boolean;
  className?: string;
}) {
  const trendLabel =
    trend === null || trend === undefined
      ? null
      : trend > 0
        ? `Up ${trend}`
        : trend < 0
          ? `Down ${Math.abs(trend)}`
          : "No change";
  return (
    <div className={cn(flush ? "min-w-0" : "nx-card p-4", className)}>
      <p className="nx-label">{label}</p>
      <p className="nx-metric mt-2 text-ink">{String(value)}</p>
      {trendLabel ? (
        <p className="mt-1 text-xs text-[var(--nx-text-secondary)]" aria-label={`Trend ${trendLabel}`}>
          {trendLabel}
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="nx-label mb-2">{eyebrow}</p> : null}
        <h1 className="nx-page-title text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--nx-text-secondary)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="nx-section-title text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-[var(--nx-text-secondary)]">{description}</p> : null}
    </div>
  );
}
