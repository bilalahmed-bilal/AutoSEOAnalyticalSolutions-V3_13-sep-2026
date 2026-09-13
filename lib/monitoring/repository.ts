import { supabaseAdmin, supabaseRest } from "@/lib/db/supabase-rest";
import type { NextRequest } from "next/server";
import { type UnknownRecord } from "@/lib/unknown";

const q = (p: Record<string, string>) => "?" + new URLSearchParams(p).toString();
export async function listMonitoringProfiles(ctx: { req: NextRequest; workspaceId: string }) {
  return supabaseRest<UnknownRecord[]>(
    ctx.req,
    "monitoring_profiles",
    {},
    q({ workspace_id: `eq.${ctx.workspaceId}`, order: "created_at.desc" })
  );
}
export async function createMonitoringProfile(
  ctx: { req: NextRequest; workspaceId: string },
  input: { name: string; targetUrl: string; frequency?: string; enabled?: boolean; createdBy?: string }
) {
  const [row] = await supabaseRest<UnknownRecord[]>(ctx.req, "monitoring_profiles", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: ctx.workspaceId,
      name: input.name,
      target_url: input.targetUrl,
      frequency: input.frequency || "daily",
      enabled: input.enabled !== false,
      created_by: input.createdBy || null,
    }),
    headers: { Prefer: "return=representation" },
  });
  return row;
}
export async function listMonitoringSnapshots(workspaceId: string, profileId?: string) {
  const p: UnknownRecord = { workspace_id: `eq.${workspaceId}`, order: "created_at.desc", limit: "50" };
  if (profileId) p.profile_id = `eq.${profileId}`;
  return supabaseAdmin<UnknownRecord[]>("monitoring_snapshots", {}, q(p));
}
export async function saveMonitoringSnapshot(workspaceId: string, profileId: string, result: UnknownRecord) {
  const r = await supabaseAdmin<UnknownRecord[]>(
    "monitoring_snapshots",
    {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        profile_id: profileId,
        target_url: result.targetUrl,
        technical_score: result.technicalScore,
        issue_count: Array.isArray(result.technical?.fixes) ? result.technical.fixes.length : 0,
        metrics: result.metrics,
        search_console: result.searchConsole,
        alerts: result.alerts,
      }),
      headers: { Prefer: "return=representation" },
    },
    ""
  );
  return r[0];
}
