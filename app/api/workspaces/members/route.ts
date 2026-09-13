import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/supabase";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "workspace_members",
    {},
    `?workspace_id=eq.${tenant.workspaceId}&select=user_id,role,created_at&order=created_at.asc`
  );
  return NextResponse.json({ members: rows });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const body = await req.json();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const role = ["admin", "editor", "member", "viewer"].includes(body.role) ? body.role : "editor";
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Valid email required." }, { status: 400 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !service)
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const invite = await fetch(`${base}/auth/v1/admin/invite`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const inviteText = await invite.text();
  let invited: UnknownRecord = null;
  try {
    invited = JSON.parse(inviteText);
  } catch {}
  if (!invite.ok && invite.status !== 422)
    return NextResponse.json({ error: "Invite send nahi ho saka." }, { status: invite.status });
  const invitedUserId = invited?.id;
  if (!invitedUserId)
    return NextResponse.json(
      {
        error:
          "User invite ho gaya ho sakta hai, lekin user ID resolve nahi hui. Existing user ko direct member ID ke zariye add karein.",
      },
      { status: 409 }
    );

  const member = await supabaseAdmin<UnknownRecord[]>("workspace_members", {
    method: "POST",
    body: JSON.stringify({ workspace_id: tenant.workspaceId, user_id: invitedUserId, role }),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
  return NextResponse.json({ member: member[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const body = await req.json();
  const memberId = String(body.userId || "");
  const role = ["admin", "editor", "member", "viewer"].includes(body.role) ? body.role : "editor";
  if (!memberId) return NextResponse.json({ error: "userId required." }, { status: 400 });
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "workspace_members",
    { method: "PATCH", body: JSON.stringify({ role }), headers: { Prefer: "return=representation" } },
    `?workspace_id=eq.${tenant.workspaceId}&user_id=eq.${memberId}&role=neq.owner`
  );
  return NextResponse.json({ member: rows[0] || null });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  const memberId = new URL(req.url).searchParams.get("userId");
  if (!memberId || memberId === user.id)
    return NextResponse.json({ error: "Valid removable userId required." }, { status: 400 });
  await supabaseAdmin(
    "workspace_members",
    { method: "DELETE" },
    `?workspace_id=eq.${tenant.workspaceId}&user_id=eq.${memberId}&role=neq.owner`
  );
  return NextResponse.json({ ok: true });
}
