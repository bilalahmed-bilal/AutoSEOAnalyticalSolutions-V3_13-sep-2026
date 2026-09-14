import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { sameOriginWrite } from "@/lib/security/request";
import { supabaseRest } from "@/lib/db/supabase-rest";
import { fetchPublicChannelStats } from "@/lib/publishers/youtube";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  try {
    const access = await requireYouTubeAccess(req, "viewer");
    if (!isYouTubeSecurityContext(access)) return access;
    const tracked = await supabaseRest<Array<{ id: string; channel_id_or_handle: string }>>(
      req,
      "youtube_competitors",
      {},
      `?workspace_id=eq.${encodeURIComponent(access.workspaceId)}&order=created_at.desc`
    );
    const results = await Promise.all(
      tracked.map(async (c) => {
        try {
          const stats = await fetchPublicChannelStats(access.settings, c.channel_id_or_handle);
          return { id: c.id, ...stats };
        } catch (err: unknown) {
          return { id: c.id, channelId: c.channel_id_or_handle, error: errorMessage(err) };
        }
      })
    );
    return NextResponse.json({ channels: results });
  } catch (err) {
    console.error("competitor list error:", err);
    return NextResponse.json({ error: "The competitor list could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireYouTubeAccess(req, "editor");
  if (!isYouTubeSecurityContext(access)) return access;
  try {
    const { channelIdOrHandle } = (await req.json()) as { channelIdOrHandle?: string };
    const value = channelIdOrHandle?.trim() || "";
    if (!value) return NextResponse.json({ error: "A channel ID or @handle is required." }, { status: 400 });
    if (value.length > 200)
      return NextResponse.json({ error: "Channel ID ya handle bohat lamba hai." }, { status: 400 });
    const [entry] = await supabaseRest<Array<{ id: string; channel_id_or_handle: string }>>(
      req,
      "youtube_competitors",
      {
        method: "POST",
        body: JSON.stringify({
          workspace_id: access.workspaceId,
          channel_id_or_handle: value,
          created_by: access.userId,
        }),
        headers: { Prefer: "return=representation" },
      }
    );
    return NextResponse.json({
      entry: { id: entry.id, platform: "youtube", channelIdOrHandle: entry.channel_id_or_handle },
    });
  } catch (err: unknown) {
    console.error("competitor add error:", err);
    const status = String(errorMessage(err, "")).includes("409") ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "This competitor is already tracked." : "Could not add." },
      { status }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const permission = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(permission)) return permission;
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });
    await supabaseRest(
      req,
      "youtube_competitors",
      { method: "DELETE" },
      `?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(permission.tenant.workspaceId)}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("competitor remove error:", err);
    return NextResponse.json({ error: "Could not remove." }, { status: 500 });
  }
}
