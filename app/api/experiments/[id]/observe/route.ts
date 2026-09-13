import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { getExperiment, upsertObservation, listObservations } from "@/lib/experiments/repository";
import { queryExperimentPage } from "@/lib/experiments/gsc";
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
  const b = await req.json();
  const variant = b.variant as "a" | "b" | "baseline";
  if (!["a", "b", "baseline"].includes(variant))
    return NextResponse.json({ error: "variant must be a, b, or baseline." }, { status: 400 });
  const start = String(b.startDate || ""),
    end = String(b.endDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end)
    return NextResponse.json({ error: "Valid startDate/endDate required." }, { status: 400 });
  try {
    const m = await queryExperimentPage(p.tenant.workspaceId, e.targetUrl, start, end);
    const obs = await upsertObservation({
      workspaceId: p.tenant.workspaceId,
      experimentId: id,
      variant,
      periodStart: start,
      periodEnd: end,
      ...m,
    });
    return NextResponse.json({ observation: obs, observations: await listObservations(p.tenant.workspaceId, id) });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, "Observation failed.") }, { status: 502 });
  }
}
