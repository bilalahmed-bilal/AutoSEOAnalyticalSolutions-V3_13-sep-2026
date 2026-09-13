import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const members = await supabaseAdmin<UnknownRecord[]>(
    "workspace_members",
    {},
    "?select=user_id,role,workspace_id,created_at&order=created_at.desc&limit=300"
  ).catch(() => []);
  const rows = q ? members.filter((row) => String(row.user_id).includes(q) || String(row.role).includes(q)) : members;
  return NextResponse.json({
    members: rows,
    note: "User emails are not listed from Auth Admin unless service-role invite APIs are used. Identifiers shown are membership records.",
  });
}

export async function POST(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  const body = (await req.json().catch(() => ({}))) as { userId?: string; email?: string };
  if (!body.userId) return NextResponse.json({ error: "userId required." }, { status: 400 });
  await supabaseAdmin("platform_admins", {
    method: "POST",
    body: JSON.stringify({ user_id: body.userId, email: body.email || null }),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  await recordAuditEvent({
    actorUserId: admin.user.id,
    action: "admin.platform_admin_granted",
    entityType: "platform_admin",
    entityId: body.userId,
  });
  return NextResponse.json({ ok: true });
}
