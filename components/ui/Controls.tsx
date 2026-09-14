import type { InputHTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative h-6 w-10 rounded-full border transition-colors",
        checked ? "border-primary bg-primary" : "border-[var(--nx-border-strong)] bg-elevated"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-[var(--nx-on-primary)] transition-transform",
          checked ? "left-5" : "left-0.5 bg-[var(--nx-text-secondary)]"
        )}
      />
    </button>
  );
}

export function Checkbox({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("h-4 w-4 accent-[var(--nx-primary)]", className)} {...rest} />;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label ? <p className="mb-1 text-xs text-muted">{label}</p> : null}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--nx-text)_8%,transparent)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-[640px] text-left text-sm", className)} {...rest} />
    </div>
  );
}
