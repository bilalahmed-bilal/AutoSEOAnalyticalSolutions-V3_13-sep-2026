"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "@/app/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";
import type { ThemeMode } from "@/lib/theme/preference";

const OPTIONS: { id: ThemeMode; label: string; icon: "sun" | "moon" | "system" }[] = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "system" },
];

export default function ThemeToggle({ compact = true }: { compact?: boolean }) {
  const { mode, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const current = OPTIONS.find((item) => item.id === mode) || OPTIONS[2];

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!compact) {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-ink/80" id={labelId}>
          Appearance
        </p>
        <div
          className="inline-flex rounded-[var(--nx-radius-sm)] border border-line p-1"
          role="radiogroup"
          aria-labelledby={labelId}
        >
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              onClick={() => void setTheme(item.id)}
              className={cn(
                "focus-ring inline-flex min-h-10 items-center gap-2 rounded-[6px] px-3 text-sm",
                mode === item.id ? "bg-elevated text-ink" : "text-[var(--nx-text-secondary)] hover:text-ink"
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <Button
        variant="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={current.icon} />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-40 rounded-[var(--nx-radius-md)] border border-line bg-elevated p-1 shadow-[var(--nx-shadow-medium)]"
        >
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={mode === item.id}
              className={cn(
                "focus-ring flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm",
                mode === item.id
                  ? "bg-[color-mix(in_srgb,var(--nx-primary)_12%,transparent)] text-ink"
                  : "text-[var(--nx-text-secondary)] hover:bg-[color-mix(in_srgb,var(--nx-text)_6%,transparent)] hover:text-ink"
              )}
              onClick={() => {
                void setTheme(item.id);
                setOpen(false);
              }}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
