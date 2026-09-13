export type AIResultKind = "fact" | "inference" | "recommendation" | "prediction" | "unknown";

export interface AIDecisionMeta {
  confidence: number;
  evidence: string[];
  uncertainty: string[];
  risk: "low" | "medium" | "high" | "critical";
  kind: AIResultKind;
}

export function parseJsonSafely<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let inString = false;
  let escaped = false;
  let normalized = "";
  for (const char of cleaned) {
    if (escaped) {
      normalized += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      normalized += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      normalized += char;
      continue;
    }
    if (inString && char === "\n") {
      normalized += "\\n";
      continue;
    }
    if (inString && char === "\r") {
      normalized += "\\r";
      continue;
    }
    if (inString && char === "\t") {
      normalized += "\\t";
      continue;
    }
    normalized += char;
  }
  try {
    return JSON.parse(normalized) as T;
  } catch {
    throw new Error("AI_INVALID_JSON");
  }
}

export function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`AI_INVALID_OUTPUT:${name}`);
}

export function assertString(value: unknown, name: string, min = 1, max = 20000): asserts value is string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max)
    throw new Error(`AI_INVALID_OUTPUT:${name}`);
}

export function assertStringArray(value: unknown, name: string, min = 0, max = 100): asserts value is string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some((v) => typeof v !== "string")) {
    throw new Error(`AI_INVALID_OUTPUT:${name}`);
  }
}

export function assertNumber(value: unknown, name: string, min: number, max: number): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`AI_INVALID_OUTPUT:${name}`);
}

export function assertEnum<T extends string>(value: unknown, name: string, allowed: readonly T[]): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`AI_INVALID_OUTPUT:${name}`);
}

export function cleanTags(tags: string[], max = 15): string[] {
  return [...new Set(tags.map((t) => t.trim().replace(/^#+/, "")).filter(Boolean))].slice(0, max);
}

export function boundedText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function classifyAIError(
  error: unknown
): "timeout" | "rate_limit" | "provider_unavailable" | "invalid_output" | "auth" | "unknown" {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("ai_invalid") || message.includes("invalid_output") || message.includes("json"))
    return "invalid_output";
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (message.includes("429") || message.includes("rate limit") || message.includes("rate_limit")) return "rate_limit";
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("api key") ||
    message.includes("authentication")
  )
    return "auth";
  if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("overloaded"))
    return "provider_unavailable";
  return "unknown";
}

export function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  return fn().catch(async (error) => {
    const kind = classifyAIError(error);
    if (retries <= 0 || !["timeout", "rate_limit", "provider_unavailable"].includes(kind)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return withRetry(fn, retries - 1);
  });
}
