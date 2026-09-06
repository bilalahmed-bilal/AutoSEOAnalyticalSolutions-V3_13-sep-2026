import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { updateDraftRemote, listDraftsRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { enqueueJob, publishJobKey } from "@/lib/jobs/queue";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "editor");
    if (!isRoleResult(permission)) return permission;
  }
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });

  const { id } = await params;

  try {
    const { action } = (await req.json()) as { action: "approve" | "reject" };

    if (action === "reject") {
      const updated = await updateDraftRemote({ req, workspaceId: tenant?.workspaceId }, id, { status: "rejected" });
      if (!updated) return NextResponse.json({ error: "Draft nahi mila." }, { status: 404 });
      return NextResponse.json({ draft: updated });
    }

    if (action === "approve") {
      const draftBefore = await updateDraftRemote({ req, workspaceId: tenant?.workspaceId }, id, { status: "approved" });
      if (!draftBefore) return NextResponse.json({ error: "Draft nahi mila." }, { status: 404 });
      if (!tenant?.workspaceId) return NextResponse.json({ draft: draftBefore, queued: false, message: "Demo mode: worker queue ke liye Supabase workspace required hai." });

      const job = await enqueueJob({
        workspaceId: tenant.workspaceId,
        type: "publish_draft",
        payload: { draftId: id },
        idempotencyKey: publishJobKey(tenant.workspaceId, id),
      });
      return NextResponse.json({ draft: draftBefore, queued: true, jobId: job?.id });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("queue action error:", err);
    return NextResponse.json({ error: "Kuch ghalat ho gaya." }, { status: 500 });
  }
}
