import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getExperiment, updateExperiment } from "@/lib/experiments/repository";
import { getDraftVersionRemote, updateDraftRemote } from "@/lib/store-repository";
import { normalizeSnapshot } from "@/lib/optimization/versioning";
import { enqueueJob, experimentPromotionJobKey } from "@/lib/jobs/queue";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  if (!a.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "admin");
  if (!isRoleResult(p)) return p;
  const id = (await params).id,
    e = await getExperiment(p.tenant.workspaceId, id);
  if (!e) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
  const winner = e.status === "winner_a" ? "a" : e.status === "winner_b" ? "b" : null;
  if (!winner)
    return NextResponse.json(
      { error: "Experiment must have a statistically supported winner before promotion." },
      { status: 409 }
    );
  const versionId = winner === "a" ? e.variantAVersionId : e.variantBVersionId;
  const version = await getDraftVersionRemote({ req, workspaceId: p.tenant.workspaceId }, versionId);
  if (!version) return NextResponse.json({ error: "Winner version not found." }, { status: 404 });
  const snap = normalizeSnapshot(version.optimized);
  const draft = await updateDraftRemote({ req, workspaceId: p.tenant.workspaceId }, e.draftId, {
    title: snap.title,
    body: snap.body,
    metaDescription: snap.metaDescription,
    status: "approved",
  });
  const job = await enqueueJob({
    workspaceId: p.tenant.workspaceId,
    type: "publish_draft",
    payload: {
      draftId: e.draftId,
      sourceVersionId: versionId,
      experimentId: id,
      experimentVariant: winner,
      promotion: true,
    },
    idempotencyKey: experimentPromotionJobKey(p.tenant.workspaceId, id, winner),
  });
  const updated = await updateExperiment(p.tenant.workspaceId, id, {
    status: "promoted",
    result: { ...(e.result || {}), promotedVariant: winner, promotedAt: new Date().toISOString() },
  });
  return NextResponse.json({ experiment: updated, draft, jobId: job?.id });
}
