import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getDraftVersionRemote, createDraftVersionRemote, updateDraftRemote } from "@/lib/store-repository";
import { enqueueJob, publishVersionJobKey } from "@/lib/jobs/queue";
import { applyDecisions, normalizeSnapshot } from "@/lib/optimization/versioning";
import { recordPublication } from "@/lib/rollback/history";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req); if (!access) return unauthorizedResponse();
  if (!access.authenticated) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "editor"); if (!isRoleResult(permission)) return permission;
  const id = (await params).id;
  const version = await getDraftVersionRemote({ req, workspaceId: permission.tenant.workspaceId }, id);
  if (!version) return NextResponse.json({ error: "Version not found." }, { status: 404 });
  if (version.status === "proposed") return NextResponse.json({ error: "Proposed version ko rollback nahi kiya ja sakta." }, { status: 409 });
  if (version.source === "original") return NextResponse.json({ error: "Original version rollback target nahi hai." }, { status: 409 });

  const snapshot = normalizeSnapshot(version.original);
  const body = await req.json().catch(() => ({})) as { reason?: string };
  const rollbackVersion = await createDraftVersionRemote(
    { req, workspaceId: permission.tenant.workspaceId },
    {
      draftId: version.draftId,
      original: { ...version.optimized },
      optimized: { ...snapshot },
      decisions: ["title", "metaDescription", "h1", "body"].map((field) => ({ field, accepted: true, rationale: body.reason ?? "Rollback to prior approved snapshot" })),
      warnings: [], source: "manual", createdBy: access.user?.id, rollbackOfVersionId: version.id,
    }
  );
  const patched = await updateDraftRemote({ req, workspaceId: permission.tenant.workspaceId }, version.draftId, {
    title: snapshot.title, body: snapshot.body, metaDescription: snapshot.metaDescription, status: "approved",
  });
  if (!patched) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const job = await enqueueJob({
    workspaceId: permission.tenant.workspaceId,
    type: "publish_draft",
    payload: { draftId: version.draftId, sourceVersionId: rollbackVersion.id, rollbackOfVersionId: version.id },
    idempotencyKey: publishVersionJobKey(permission.tenant.workspaceId, version.draftId, rollbackVersion.id),
  });
  await recordPublication({ workspaceId: permission.tenant.workspaceId, draftId: version.draftId, versionId: rollbackVersion.id, eventType: "rollback_requested", snapshot, jobId: job?.id, createdBy: access.user?.id });
  return NextResponse.json({ version: rollbackVersion, draft: patched, queued: true, jobId: job?.id, rollbackOfVersionId: version.id });
}
