import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { isFeatureKey } from "@/lib/product/features";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required." }, { status: 400 });
  const rows = await supabaseAdmin(
    "entitlement_overrides",
    {},
    `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,feature_key,effect,expires_at,reason,created_at&order=created_at.desc`
  ).catch(() => []);
  return NextResponse.json({ overrides: rows });
}

export async function POST(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string;
    featureKey?: string;
    effect?: string;
    reason?: string;
    expiresAt?: string | null;
  };
  if (!body.workspaceId || !body.featureKey || !isFeatureKey(body.featureKey)) {
    return NextResponse.json({ error: "workspaceId and a valid featureKey are required." }, { status: 400 });
  }
  const effect = body.effect === "revoke" ? "revoke" : "grant";
  await supabaseAdmin("entitlement_overrides", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: body.workspaceId,
      feature_key: body.featureKey,
      effect,
      reason: body.reason || "Admin override",
      expires_at: body.expiresAt || null,
      created_by: admin.user.id,
    }),
    headers: { Prefer: "return=minimal" },
  });
  await recordAuditEvent({
    workspaceId: body.workspaceId,
    actorUserId: admin.user.id,
    action: "admin.entitlement_override",
    entityType: "entitlement",
    metadata: { featureKey: body.featureKey, effect },
  });
  return NextResponse.json({ ok: true });
}
