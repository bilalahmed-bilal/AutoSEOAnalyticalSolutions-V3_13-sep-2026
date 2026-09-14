export const THEME_COOKIE = "nexora_theme";
export const THEME_STORAGE_KEY = "nexora.theme";
export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = "light" | "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemeMode(value?: string | null): ThemeMode {
  return isThemeMode(value) ? value : "system";
}

export function resolveTheme(mode: ThemeMode, prefersDark?: boolean): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return prefersDark ? "dark" : "light";
}

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function readCookieTheme(): ThemeMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${THEME_COOKIE}=`));
  if (!match) return null;
  return parseThemeMode(decodeURIComponent(match.split("=").slice(1).join("=")));
}

export function prefersDarkScheme(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function persistTheme(mode: ThemeMode) {
  const next = parseThemeMode(mode);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }
  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }
  return next;
}

export function applyTheme(mode: ThemeMode, resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolved;
}

export const THEME_BOOT_SCRIPT = `(function(){
  var m="system";
  try {
    var c=document.cookie.split("; ").find(function(r){return r.indexOf("${THEME_COOKIE}=")==0;});
    if(c) m=decodeURIComponent(c.split("=").slice(1).join("="));
    else m=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";
  } catch(e) {}
  if(m!=="light"&&m!=="dark"&&m!=="system") m="system";
  var dark=false;
  try { dark=window.matchMedia("(prefers-color-scheme: dark)").matches; } catch(e) { dark=true; }
  var r=m==="system"?(dark?"dark":"light"):m;
  var el=document.documentElement;
  el.setAttribute("data-theme", r);
  el.setAttribute("data-theme-mode", m);
  el.style.colorScheme=r;
})();`;
