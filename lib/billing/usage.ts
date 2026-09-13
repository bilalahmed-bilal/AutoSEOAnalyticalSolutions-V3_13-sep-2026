import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UsageMetric } from "@/lib/product/features";
import { type UnknownRecord } from "@/lib/unknown";

const memory = new Map<string, number>();

function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function memoryKey(workspaceId: string, metric: UsageMetric, period = periodKey()) {
  return `${workspaceId}:${metric}:${period}`;
}

export async function getUsageCount(workspaceId: string, metric: UsageMetric): Promise<number> {
  const period = periodKey();
  try {
    const rows = await supabaseAdmin<Array<{ quantity: number }>>(
      "usage_counters",
      {},
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&metric=eq.${encodeURIComponent(metric)}&period=eq.${period}&select=quantity&limit=1`
    );
    return Number(rows[0]?.quantity || 0);
  } catch {
    if (process.env.NODE_ENV === "production") {
      console.warn("usage_counters unavailable; DEVELOPMENT_ONLY memory metering is not durable in production.");
    }
    return memory.get(memoryKey(workspaceId, metric, period)) || 0;
  }
}

export async function incrementUsage(
  workspaceId: string,
  metric: UsageMetric,
  quantity = 1,
  actorUserId?: string | null
): Promise<number> {
  const period = periodKey();
  const current = await getUsageCount(workspaceId, metric);
  const next = current + quantity;
  memory.set(memoryKey(workspaceId, metric, period), next);
  try {
    await supabaseAdmin(
      "usage_counters",
      {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          metric,
          period,
          quantity: next,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      },
      "?on_conflict=workspace_id,metric,period"
    );
    await supabaseAdmin("usage_events", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        actor_user_id: actorUserId || null,
        metric,
        quantity,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    // DEVELOPMENT_ONLY fallback: in-memory counters are not durable across instances.
  }
  return next;
}

export function usagePersistenceMode(): "database" | "DEVELOPMENT_ONLY" {
  return process.env.NODE_ENV === "production" ? "database" : "DEVELOPMENT_ONLY";
}

export async function listUsage(workspaceId: string): Promise<UnknownRecord[]> {
  const period = periodKey();
  try {
    return await supabaseAdmin<UnknownRecord[]>(
      "usage_counters",
      {},
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&period=eq.${period}&select=metric,quantity,period,updated_at`
    );
  } catch {
    return [...memory.entries()]
      .filter(([key]) => key.startsWith(`${workspaceId}:`) && key.endsWith(`:${period}`))
      .map(([key, quantity]) => ({
        metric: key.split(":")[1],
        quantity,
        period,
        updated_at: new Date().toISOString(),
      }));
  }
}
