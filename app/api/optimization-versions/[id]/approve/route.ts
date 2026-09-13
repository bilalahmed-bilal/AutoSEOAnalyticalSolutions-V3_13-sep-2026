import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getTenantContext } from "@/lib/tenant";
import { getDraftVersionRemote, updateDraftVersionRemote } from "@/lib/store-repository";
import { updateDraftRemote } from "@/lib/store-repository";
import { applyDecisions } from "@/lib/optimization/versioning";
import { enqueueJob, publishJobKey } from "@/lib/jobs/queue";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (!access.authenticated) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(permission)) return permission;
  const tenant = await getTenantContext(req);
  if (!tenant) return NextResponse.json({ error: "Workspace required." }, { status: 400 });
  const id = (await params).id;
  const version = await getDraftVersionRemote({ req, workspaceId: tenant.workspaceId }, id);
  if (!version) return NextResponse.json({ error: "Version not found." }, { status: 404 });
  if (version.status !== "proposed")
    return NextResponse.json({ error: "Only proposed versions can be approved." }, { status: 409 });
  const approved = applyDecisions(version.original, version.optimized, version.decisions);
  const draft = await updateDraftRemote({ req, workspaceId: tenant.workspaceId }, version.draftId, {
    title: approved.title,
    body: approved.body,
    metaDescription: approved.metaDescription,
    status: "approved",
  });
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  await updateDraftVersionRemote({ req, workspaceId: tenant.workspaceId }, id, {
    status: "approved",
    approved_at: new Date().toISOString(),
  });
  const job = await enqueueJob({
    workspaceId: tenant.workspaceId,
    type: "publish_draft",
    payload: { draftId: version.draftId, sourceVersionId: id },
    idempotencyKey: publishJobKey(tenant.workspaceId, version.draftId),
  });
  const applied = await updateDraftVersionRemote({ req, workspaceId: tenant.workspaceId }, id, {
    status: "applied",
    applied_at: new Date().toISOString(),
  });
  return NextResponse.json({ version: applied, draft, queued: true, jobId: job?.id });
}
