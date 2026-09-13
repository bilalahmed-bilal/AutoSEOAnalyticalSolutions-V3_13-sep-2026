import { supabaseAdmin } from "@/lib/db/supabase-rest";

const SECRET_KEYS = /token|secret|password|authorization|api[_-]?key|refresh|cookie|card|cvv/i;

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEYS.test(key)) continue;
    if (typeof value === "string" && value.length > 500) next[key] = value.slice(0, 500);
    else next[key] = value;
  }
  return next;
}

export async function recordAuditEvent(entry: {
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin("audit_logs", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: entry.workspaceId || null,
        actor_user_id: entry.actorUserId || null,
        action: entry.action,
        entity_type: entry.entityType || null,
        entity_id: entry.entityId || null,
        metadata: sanitizeMetadata(entry.metadata),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch (error) {
    console.error("audit event persist failed", error instanceof Error ? error.message : "unknown");
  }
}
