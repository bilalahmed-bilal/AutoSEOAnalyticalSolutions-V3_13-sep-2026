import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "icon";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-[var(--nx-on-primary)] hover:bg-primary-hover border border-transparent shadow-[var(--nx-shadow-subtle)]",
  secondary:
    "bg-elevated text-ink border border-[var(--nx-border-strong)] hover:border-[color-mix(in_srgb,var(--nx-primary)_40%,var(--nx-border-strong))]",
  ghost:
    "bg-transparent text-ink/80 hover:bg-[color-mix(in_srgb,var(--nx-text)_6%,transparent)] border border-transparent",
  destructive:
    "bg-[var(--nx-danger-bg)] text-danger border border-[var(--nx-danger-border)] hover:bg-[color-mix(in_srgb,var(--nx-danger)_16%,transparent)]",
  icon: "bg-transparent text-ink/80 hover:bg-[color-mix(in_srgb,var(--nx-text)_6%,transparent)] border border-transparent px-0",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-3.5 text-sm",
  lg: "min-h-11 px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-[var(--nx-radius-sm)] font-medium transition-[background-color,border-color,opacity,transform] duration-[var(--nx-fast)] ease-[var(--nx-ease)] disabled:cursor-not-allowed disabled:opacity-45",
        variant === "icon" ? "h-10 w-10 px-0" : sizes[size],
        variants[variant],
        className
      )}
      {...rest}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-current/50" aria-hidden /> : null}
      {children}
    </button>
  );
}
