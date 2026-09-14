import type { CSSProperties, HTMLAttributes, SVGProps } from "react";
import { cn } from "@/lib/ui/cn";
import type { NavIcon } from "@/lib/ui/nav";

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function Path({ d }: { d: string }) {
  return <path d={d} />;
}

const PATHS: Record<
  NavIcon | "sun" | "moon" | "system" | "menu" | "close" | "chevron" | "plus" | "bell" | "ai",
  string
> = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-8.5-9h17M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18",
  shield: "M12 3 5 6v6c0 4.2 2.7 7.4 7 9 4.3-1.6 7-4.8 7-9V6z",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  pen: "M4 20h4L20 8l-4-4L4 16v4Zm10-14 4 4",
  youtube:
    "M22 12s0-3.2-.4-4.6a2.7 2.7 0 0 0-1.9-1.9C18.2 5 12 5 12 5s-6.2 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.8 2 12 2 12s0 3.2.4 4.6a2.7 2.7 0 0 0 1.9 1.9C5.8 19 12 19 12 19s6.2 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.4.4-4.6.4-4.6ZM10 15.5v-7l6 3.5z",
  facebook: "M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4V10c0-.6.4-1 1-1Z",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.3-1.3h.01",
  whatsapp:
    "M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Zm-5.2 2.2c-.3-.1-1.8-.9-2.1-1s-.5-.1-.7.2l-.8 1c-.2.2-.4.3-.7.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.4-1.8-.1-.3 0-.4.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.2.2-1 .9-1 2.2s1 2.6 1.1 2.8c.1.2 1.9 2.9 4.7 4.1.7.3 1.3.5 1.8.6.8.2 1.5.2 2 .1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3Z",
  chart: "M4 19V5M4 19h16M8 16v-5m4 5V8m4 8v-3",
  users: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 2a3.5 3.5 0 1 0 0-7",
  file: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6",
  spark:
    "M12 3v4M12 17v4M5 12H3m18 0h-2M6.2 6.2 8 8m8 8 1.8 1.8M17.8 6.2 16 8M8 16l-1.8 1.8M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
  cpu: "M8 8h8v8H8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2",
  send: "M4 12 20 4 14 20l-2-7z",
  calendar: "M7 4v3M17 4v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  workflow: "M6 6h4v4H6zM14 14h4v4h-4zM10 8h4a2 2 0 0 1 2 2v4",
  check: "M5 12.5 9.5 17 19 7",
  plug: "M8 3v5M16 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a3.5 3.5 0 0 0-3-3.45",
  usage: "M4 19h16M6 16l3-5 3 3 4-7 2 4",
  credit: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18",
  settings:
    "M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7ZM19.4 15a7.7 7.7 0 0 0 .1-2l2-1.5-2-3.5-2.4.5a7.8 7.8 0 0 0-1.7-1L15 4h-6l-.4 2.5a7.8 7.8 0 0 0-1.7 1L6.5 8 4.5 11.5 6.5 13a7.7 7.7 0 0 0 .1 2l-2 1.5 2 3.5 2.4-.5a7.8 7.8 0 0 0 1.7 1L9 20h6l.4-2.5a7.8 7.8 0 0 0 1.7-1l2.4.5 2-3.5z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.8L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
  moon: "M18 13a7 7 0 1 1-7-9 7 7 0 0 0 7 9Z",
  system: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4zm4 13h8",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "M8 10l4 4 4-4",
  plus: "M12 5v14M5 12h14",
  bell: "M6 16h12l-1.2-2.4a6 6 0 0 1-.8-3.1V9a5 5 0 0 1 10 0v1.5c0 1.1-.3 2.2-.8 3.1L18 16M10 19a2 2 0 0 0 4 0",
  ai: "M12 3 9 9l-6 1 4.5 4.2L6 21l6-3.4L18 21l-1.5-6.8L21 10l-6-1z",
};

export function Icon({
  name,
  className,
  title,
  ...rest
}: { name: keyof typeof PATHS; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg className={cn("h-[1.1em] w-[1.1em] shrink-0", className)} {...svgProps} {...rest}>
      {title ? <title>{title}</title> : null}
      <Path d={PATHS[name]} />
    </svg>
  );
}

export function StatusDot({
  tone = "muted",
  className,
  ...rest
}: { tone?: "success" | "warning" | "danger" | "info" | "muted" | "ai" } & HTMLAttributes<HTMLSpanElement>) {
  const color: Record<string, string> = {
    success: "var(--nx-success)",
    warning: "var(--nx-warning)",
    danger: "var(--nx-danger)",
    info: "var(--nx-info)",
    muted: "var(--nx-text-muted)",
    ai: "var(--nx-ai)",
  };
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", className)}
      style={{ background: color[tone] } as CSSProperties}
      {...rest}
    />
  );
}
