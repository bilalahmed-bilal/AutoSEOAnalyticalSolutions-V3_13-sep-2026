import { DEFAULT_LANGUAGE_CODE, languageDefinition } from "./registry";

function localeOf(code?: string | null): string {
  return languageDefinition(code || DEFAULT_LANGUAGE_CODE).locale;
}

export function formatDate(value: Date | string | number, code?: string | null): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeOf(code), { dateStyle: "medium" }).format(date);
}

export function formatTime(value: Date | string | number, code?: string | null): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeOf(code), { timeStyle: "short" }).format(date);
}

export function formatNumber(value: number, code?: string | null): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(localeOf(code)).format(value);
}

export function formatCurrency(value: number, currency = "USD", code?: string | null): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(localeOf(code), { style: "currency", currency }).format(value);
}

export function pluralize(count: number, one: string, other: string): string {
  return Math.abs(count) === 1 ? one : other;
}
