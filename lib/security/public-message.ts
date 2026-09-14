const SENSITIVE =
  /token|stack|graph\.facebook|googleapis|ECONN|postgres|supabase|authorization|bearer |access_token|refresh_token|apikey|service_role|secret/i;

function rawMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function publicErrorMessage(err: unknown, fallback: string): string {
  const raw = rawMessage(err, fallback);
  if (!raw || raw === fallback) return fallback;
  if (SENSITIVE.test(raw) || raw.includes("{") || raw.includes("<") || raw.length > 280) return fallback;
  return raw;
}
