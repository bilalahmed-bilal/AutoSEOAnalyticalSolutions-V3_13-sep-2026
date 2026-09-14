import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { addCalendarItemRemote, listCalendarItemsRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import type { Channel } from "@/lib/store";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  return NextResponse.json({ items: await listCalendarItemsRemote({ req, workspaceId: tenant?.workspaceId }) });
}

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "editor");
    if (!isRoleResult(permission)) return permission;
  }
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant)
    return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  try {
    const { channel, topic, scheduledDate } = (await req.json()) as {
      channel: Channel;
      topic: string;
      scheduledDate: string;
    };
    if (!channel || !topic || !scheduledDate) {
      return NextResponse.json({ error: "Channel, topic, and date are required." }, { status: 400 });
    }
    const item = await addCalendarItemRemote(
      { req, workspaceId: tenant?.workspaceId },
      { channel, topic, scheduledDate }
    );
    return NextResponse.json({ item });
  } catch (err) {
    console.error("calendar add error:", err);
    return NextResponse.json({ error: "The calendar item could not be added." }, { status: 500 });
  }
}
