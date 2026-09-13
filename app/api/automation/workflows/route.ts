import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { getTenantContext } from "@/lib/tenant";
import { createWorkflow, listWorkflows } from "@/lib/automation-repository";
import { validateWorkflowInput } from "@/lib/automation-workflows";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  const t = await getTenantContext(req);
  if (!t) return Response.json({ error: "Workspace access required." }, { status: 403 });
  try {
    return Response.json({ workflows: await listWorkflows({ req, workspaceId: t.workspaceId }) });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to load workflows.") }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  const t = await getTenantContext(req);
  if (!t) return Response.json({ error: "Workspace access required." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    const steps = validateWorkflowInput({
      name: String(b.name || ""),
      triggerType: String(b.triggerType || "manual"),
      schedule: typeof b.schedule === "string" ? b.schedule : undefined,
      steps: b.steps,
    });
    const w = await createWorkflow(
      { req, workspaceId: t.workspaceId },
      {
        name: String(b.name).trim(),
        description: typeof b.description === "string" ? b.description.trim() : undefined,
        status: b.status || "active",
        triggerType: String(b.triggerType || "manual"),
        schedule: b.schedule,
        steps,
        createdBy: a.user.id,
      }
    );
    return Response.json({ workflow: w });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to create workflow.") }, { status: 400 });
  }
}
