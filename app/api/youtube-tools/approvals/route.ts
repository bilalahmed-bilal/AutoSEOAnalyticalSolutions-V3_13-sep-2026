import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { listApprovals } from "@/lib/approval/repository";

export async function GET(req: NextRequest) {
  const access = await requireYouTubeAccess(req, "viewer");
  if (!isYouTubeSecurityContext(access)) return access;
  const status = new URL(req.url).searchParams.get("status") || undefined;
  return NextResponse.json({ approvals: await listApprovals({ req, workspaceId: access.workspaceId }, status) });
}
