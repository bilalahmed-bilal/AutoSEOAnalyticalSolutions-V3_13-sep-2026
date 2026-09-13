import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { listActivePlans } from "@/lib/billing/catalog";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { FEATURE_KEYS } from "@/lib/product/features";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  return NextResponse.json({ plans: listActivePlans(), features: FEATURE_KEYS });
}

export async function POST(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string;
    planSlug?: string;
    status?: string;
  };
  if (!body.workspaceId || !body.planSlug) {
    return NextResponse.json({ error: "workspaceId and planSlug are required." }, { status: 400 });
  }
  const status = ["trial", "active", "grace", "restricted", "canceled", "past_due"].includes(String(body.status || ""))
    ? body.status
    : "active";
  await supabaseAdmin("workspace_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: body.workspaceId,
      plan_slug: body.planSlug,
      status,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  await recordAuditEvent({
    workspaceId: body.workspaceId,
    actorUserId: admin.user.id,
    action: "admin.subscription_assigned",
    entityType: "subscription",
    metadata: { planSlug: body.planSlug, status },
  });
  return NextResponse.json({ ok: true });
}
