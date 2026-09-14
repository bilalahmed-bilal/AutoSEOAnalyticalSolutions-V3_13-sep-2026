import { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

type LimitConfig = { windowMs: number; limit: number };

const LIMITS: Record<string, LimitConfig> = {
  default: { windowMs: 60_000, limit: 60 },
  "auth-session": { windowMs: 60_000, limit: 10 },
  "oauth-start": { windowMs: 60_000, limit: 10 },
  "seo-analyze": { windowMs: 60_000, limit: 20 },
  "site-audit": { windowMs: 60_000, limit: 20 },
  "optimize-content": { windowMs: 60_000, limit: 20 },
  "content-intelligence": { windowMs: 60_000, limit: 20 },
  "keyword-intelligence": { windowMs: 60_000, limit: 20 },
  "ai-generate": { windowMs: 60_000, limit: 20 },
  publish: { windowMs: 60_000, limit: 20 },
  "auth-password": { windowMs: 60_000, limit: 8 },
  admin: { windowMs: 60_000, limit: 40 },
  "workspaces-list": { windowMs: 60_000, limit: 60 },
  "workspace-create": { windowMs: 60_000, limit: 10 },
};

function getClientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function identityKey(req: NextRequest): string {
  const auth = req.headers.get("authorization")?.slice(0, 24) || "";
  const workspace = req.headers.get("x-workspace-id") || "";
  return `${getClientKey(req)}:${auth}:${workspace}`;
}

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS / 2) break;
  }
  if (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
}

/**
 * In-process rate limiter.
 * Distributed/shared limiting REQUIRES_PRODUCTION_INFRASTRUCTURE (Redis or equivalent).
 */
export function checkRateLimit(req: NextRequest, scope = "default") {
  const config = LIMITS[scope] || LIMITS.default;
  const key = `${scope}:${identityKey(req)}`;
  const now = Date.now();
  prune(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true, remaining: config.limit - 1, retryAfterSeconds: 0, backend: "in-process" as const };
  }

  if (current.count >= config.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
      backend: "in-process" as const,
    };
  }

  current.count += 1;
  return { ok: true, remaining: config.limit - current.count, retryAfterSeconds: 0, backend: "in-process" as const };
}

export const RATE_LIMIT_BACKEND = "in-process";
