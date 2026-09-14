import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai";

const tones: Record<Tone, string> = {
  neutral: "border-[var(--nx-border-strong)] bg-elevated text-[var(--nx-text-secondary)]",
  primary:
    "border-[color-mix(in_srgb,var(--nx-primary)_30%,var(--nx-border))] bg-[color-mix(in_srgb,var(--nx-primary)_10%,transparent)] text-primary",
  success: "border-[var(--nx-success-border)] bg-[var(--nx-success-bg)] text-success",
  warning: "border-[var(--nx-warning-border)] bg-[var(--nx-warning-bg)] text-warning",
  danger: "border-[var(--nx-danger-border)] bg-[var(--nx-danger-bg)] text-danger",
  info: "border-[color-mix(in_srgb,var(--nx-info)_30%,var(--nx-border))] bg-[color-mix(in_srgb,var(--nx-info)_10%,transparent)] text-info",
  ai: "border-[var(--nx-ai-border)] bg-[var(--nx-ai-bg)] text-[var(--nx-ai)]",
};

export function Badge({ tone = "neutral", className, ...rest }: { tone?: Tone } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--nx-radius-pill)] border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className
      )}
      {...rest}
    />
  );
}

export function AiBadge({ children = "AIBISORA AI" }: { children?: ReactNode }) {
  return <Badge tone="ai">{children}</Badge>;
}

export function ApprovalBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const tone: Tone =
    key.includes("fail") || key.includes("reject")
      ? "danger"
      : key.includes("pending") || key.includes("review")
        ? "warning"
        : key.includes("publish") || key.includes("approv")
          ? "success"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function Alert({
  tone = "danger",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("rounded-[var(--nx-radius-sm)] border px-3 py-2 text-sm", tones[tone], className)} role="alert">
      {children}
    </p>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="nx-card px-6 py-10 text-center">
      <h2 className="nx-section-title text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-pretty text-sm text-[var(--nx-text-secondary)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--nx-radius-sm)] bg-[color-mix(in_srgb,var(--nx-text)_8%,transparent)]",
        className
      )}
      aria-hidden
    />
  );
}
