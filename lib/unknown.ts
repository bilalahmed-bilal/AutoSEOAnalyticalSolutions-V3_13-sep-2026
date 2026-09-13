/**
 * JSON/PostgREST/UI boundary value.
 * Specific domain types should be used at module interiors; this alias exists so
 * loosely-shaped API payloads can compile without scattering `any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnknownRecord = any;

export function errorMessage(err: unknown, fallback = "Request failed."): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

export function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function scheduleMount(run: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) run();
  });
  return () => {
    cancelled = true;
  };
}
