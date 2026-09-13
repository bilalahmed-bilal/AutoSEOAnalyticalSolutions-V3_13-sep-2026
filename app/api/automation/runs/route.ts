import { NextRequest } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { createRun, listRuns } from "@/lib/automation-repository";
import { getWorkflow } from "@/lib/automation-repository";
import { isRoleResult, requireWorkspaceRole } from "@/lib/auth/rbac";
import { errorMessage } from "@/lib/unknown";

export async function GET(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "viewer");
  if (!isRoleResult(permission)) return permission;
  const t = permission.tenant;
  if (!t) return Response.json({ error: "Workspace access required." }, { status: 403 });
  return Response.json({
    runs: await listRuns(
      { req, workspaceId: t.workspaceId },
      new URL(req.url).searchParams.get("workflowId") || undefined
    ),
  });
}
export async function POST(req: NextRequest) {
  const a = await requireApiAccess(req);
  if (!a) return unauthorizedResponse();
  const permission = await requireWorkspaceRole(req, "editor");
  if (!isRoleResult(permission)) return permission;
  const t = permission.tenant;
  if (!t) return Response.json({ error: "Workspace access required." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.workflowId !== "string") return Response.json({ error: "workflowId is required." }, { status: 400 });
  const w = await getWorkflow({ req, workspaceId: t.workspaceId }, b.workflowId);
  if (!w) return Response.json({ error: "Workflow not found." }, { status: 404 });
  if (w.status !== "active") return Response.json({ error: "Workflow is not active." }, { status: 400 });
  try {
    return Response.json({
      run: await createRun(
        { req, workspaceId: t.workspaceId },
        {
          workflowId: w.id,
          input: typeof b.input === "object" && b.input ? b.input : {},
          createdBy: a.user.id,
          idempotencyKey: typeof b.idempotencyKey === "string" ? b.idempotencyKey.trim() : undefined,
        }
      ),
    });
  } catch (e: unknown) {
    return Response.json({ error: errorMessage(e, "Unable to create workflow run.") }, { status: 400 });
  }
}
