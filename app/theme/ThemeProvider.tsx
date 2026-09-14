"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyTheme,
  parseThemeMode,
  persistTheme,
  prefersDarkScheme,
  readCookieTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme/preference";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialMode(initialMode?: ThemeMode): ThemeMode {
  return parseThemeMode(readStoredTheme() || readCookieTheme() || initialMode || "system");
}

function subscribeScheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function ThemeProvider({ children, initialMode = "system" }: { children: ReactNode; initialMode?: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(() => readInitialMode(initialMode));
  const systemDark = useSyncExternalStore(subscribeScheme, prefersDarkScheme, () => true);
  const resolved = resolveTheme(mode, systemDark);

  useEffect(() => {
    applyTheme(mode, resolveTheme(mode, prefersDarkScheme()));
  }, [mode, systemDark]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preferences", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.theme) return;
        const next = persistTheme(parseThemeMode(data.theme));
        setMode(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (nextMode: ThemeMode) => {
    const saved = persistTheme(nextMode);
    setMode(saved);
    applyTheme(saved, resolveTheme(saved, prefersDarkScheme()));
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: saved }),
      });
    } catch {
      // Cookie/local persistence still applies.
    }
  }, []);

  const value = useMemo(() => ({ mode, resolved, setTheme }), [mode, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
