import crypto from "node:crypto";

export function createIdempotencyKey(parts: string[]): string {
  const canonical = parts.map((p) => p.trim()).join("\n");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function nextRetryAt(attempt: number, now = Date.now()): Date {
  const safeAttempt = Math.max(1, Math.min(attempt, 8));
  const delayMs = Math.min(15 * 60_000, 2 ** safeAttempt * 1000);
  return new Date(now + delayMs);
}
