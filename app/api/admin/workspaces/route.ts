import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "workspaces",
    {},
    "?select=id,name,slug,status,created_at,suspended_at,suspended_reason&order=created_at.desc&limit=200"
  ).catch(() => []);
  return NextResponse.json({ workspaces: rows });
}

export async function POST(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string;
    action?: "suspend" | "restore";
    reason?: string;
  };
  if (!body.workspaceId || !body.action) {
    return NextResponse.json({ error: "workspaceId and action are required." }, { status: 400 });
  }
  const status = body.action === "suspend" ? "suspended" : "active";
  await supabaseAdmin(
    "workspaces",
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        suspended_at: body.action === "suspend" ? new Date().toISOString() : null,
        suspended_reason: body.action === "suspend" ? String(body.reason || "Suspended by admin") : null,
      }),
      headers: { Prefer: "return=minimal" },
    },
    `?id=eq.${encodeURIComponent(body.workspaceId)}`
  );
  await recordAuditEvent({
    workspaceId: body.workspaceId,
    actorUserId: admin.user.id,
    action: body.action === "suspend" ? "admin.workspace_suspended" : "admin.workspace_restored",
    entityType: "workspace",
    entityId: body.workspaceId,
    metadata: { reason: body.reason || null },
  });
  return NextResponse.json({ ok: true, status });
}
