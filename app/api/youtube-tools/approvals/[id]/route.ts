import { NextRequest, NextResponse } from "next/server";
import { requireYouTubeAccess, isYouTubeSecurityContext } from "@/lib/youtube-security";
import { reviewApproval } from "@/lib/approval/repository";
import { sameOriginWrite } from "@/lib/security/request";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const access = await requireYouTubeAccess(req, "admin");
  if (!isYouTubeSecurityContext(access)) return access;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body?.decision;
  if (decision !== "approved" && decision !== "rejected")
    return NextResponse.json({ error: "decision must be approved or rejected." }, { status: 400 });
  const item = await reviewApproval(
    { req, workspaceId: access.workspaceId, reviewerId: access.userId },
    id,
    decision,
    typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 1000) : undefined
  );
  if (!item) return NextResponse.json({ error: "Approval not found or already reviewed." }, { status: 409 });
  return NextResponse.json({ approval: item });
}
