"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LANGUAGE_CODE,
  languageDefinition,
  selectableLanguages,
  type LanguageDefinition,
} from "@/lib/i18n/registry";
import { persistUiLanguage, resolvedBrowserUiLanguage } from "@/lib/i18n/preference";
import { translate } from "@/lib/i18n/translate";
import { formatCurrency, formatDate, formatNumber, formatTime } from "@/lib/i18n/format";

interface LanguageContextValue {
  language: LanguageDefinition;
  setUiLanguage: (code: string) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: Date | string | number) => string;
  formatTime: (value: Date | string | number) => string;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number, currency?: string) => string;
  options: LanguageDefinition[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE_CODE,
  userLanguage,
  workspaceId,
}: {
  children: ReactNode;
  initialLanguage?: string;
  userLanguage?: string | null;
  workspaceId?: string | null;
}) {
  const [code, setCode] = useState(() => resolvedBrowserUiLanguage(userLanguage || initialLanguage, workspaceId).code);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preferences", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.uiLanguage) return;
        const next = persistUiLanguage(String(data.uiLanguage), workspaceId);
        setCode(next);
        const meta = languageDefinition(next);
        document.documentElement.lang = meta.locale;
        document.documentElement.dir = meta.direction;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userLanguage, workspaceId]);

  const setUiLanguage = useCallback(
    async (nextCode: string) => {
      const saved = persistUiLanguage(nextCode, workspaceId);
      setCode(saved);
      if (typeof document !== "undefined") {
        const meta = languageDefinition(saved);
        document.documentElement.lang = meta.locale;
        document.documentElement.dir = meta.direction;
      }
      try {
        await fetch("/api/preferences", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uiLanguage: saved, workspaceId: workspaceId || undefined }),
        });
      } catch {
        // Cookie/local persistence still applies.
      }
    },
    [workspaceId]
  );

  const value = useMemo<LanguageContextValue>(() => {
    const language = languageDefinition(code);
    return {
      language,
      setUiLanguage,
      t: (key, vars) => translate(key, vars, language.code),
      formatDate: (value) => formatDate(value, language.code),
      formatTime: (value) => formatTime(value, language.code),
      formatNumber: (value) => formatNumber(value, language.code),
      formatCurrency: (value, currency) => formatCurrency(value, currency, language.code),
      options: selectableLanguages(),
    };
  }, [code, setUiLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useUiLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const language = languageDefinition(DEFAULT_LANGUAGE_CODE);
    return {
      language,
      setUiLanguage: async () => undefined,
      t: (key: string, vars?: Record<string, string | number>) => translate(key, vars, language.code),
      formatDate: (value: Date | string | number) => formatDate(value, language.code),
      formatTime: (value: Date | string | number) => formatTime(value, language.code),
      formatNumber: (value: number) => formatNumber(value, language.code),
      formatCurrency: (value: number, currency?: string) => formatCurrency(value, currency, language.code),
      options: selectableLanguages(),
    };
  }
  return ctx;
}
