import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getWorkflow, updateWorkflow } from "@/lib/automation-repository";
import { validateWorkflowInput } from "@/lib/automation-workflows";
import { errorMessage } from "@/lib/unknown";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const t = permission.tenant;
  if (!t) return Response.json({ error: "Workspace access required." }, { status: 403 });
  const w = await getWorkflow({ req, workspaceId: t.workspaceId }, (await params).id);
  return w ? Response.json({ workflow: w }) : Response.json({ error: "Workflow not found." }, { status: 404 });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(permission)) return permission;
  const t = permission.tenant;
  const id = (await params).id;
  const b = await req.json().catch(() => ({}));
  try {
    const existing = await getWorkflow({ req, workspaceId: t.workspaceId }, id);
    if (!existing) return Response.json({ error: "Workflow not found." }, { status: 404 });
    const merged = {
      name: String(b.name ?? existing.name),
      triggerType: String(b.triggerType ?? existing.triggerType),
      schedule: typeof (b.schedule ?? existing.schedule) === "string" ? (b.schedule ?? existing.schedule) : undefined,
      steps: b.steps ?? existing.steps,
    };
    const steps = validateWorkflowInput(merged);
    const w = await updateWorkflow({ req, workspaceId: t.workspaceId }, id, {
      name: merged.name,
      description: typeof b.description === "string" ? b.description : existing.description,
      status: typeof b.status === "string" ? b.status : existing.status,
      triggerType: merged.triggerType,
      schedule: merged.schedule,
      steps,
    });
    return Response.json({ workflow: w });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to update workflow.") }, { status: 400 });
  }
}
