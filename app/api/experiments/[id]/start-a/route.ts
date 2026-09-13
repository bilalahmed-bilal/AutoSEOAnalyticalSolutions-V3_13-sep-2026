import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getExperiment } from "@/lib/experiments/repository";
import { queueExperimentVariant } from "@/lib/experiments/service";
import { errorMessage } from "@/lib/unknown";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  if (!a.authenticated) return unauthorizedResponse();
  const p = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(p)) return p;
  const id = (await params).id,
    e = await getExperiment(p.tenant.workspaceId, id);
  if (!e) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
  if (e.status !== "draft")
    return NextResponse.json({ error: "Only draft experiments can start Variant A." }, { status: 409 });
  try {
    return NextResponse.json(await queueExperimentVariant({ req, workspaceId: p.tenant.workspaceId }, id, "a"));
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, "Variant A start failed.") }, { status: 400 });
  }
}
