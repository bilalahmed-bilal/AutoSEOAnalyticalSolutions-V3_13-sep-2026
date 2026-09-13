import type { NextRequest } from "next/server";
import { supabaseRest } from "@/lib/db/supabase-rest";
import type { RiskTier, YouTubeActionType } from "./risk";
import { type UnknownRecord } from "@/lib/unknown";

const q = (p: Record<string, string>) => "?" + new URLSearchParams(p).toString();

export type ApprovalItem = {
  id: string;
  workspaceId: string;
  actionType: YouTubeActionType;
  risk: RiskTier;
  status: "pending" | "approved" | "rejected" | "executed" | "cancelled" | "blocked";
  targetId?: string;
  payload: Record<string, unknown>;
  reason: string;
  requestedBy?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  executedAt?: string;
};

const map = (r: UnknownRecord): ApprovalItem => ({
  id: r.id,
  workspaceId: r.workspace_id,
  actionType: r.action_type,
  risk: r.risk,
  status: r.status,
  targetId: r.target_id ?? undefined,
  payload: r.payload ?? {},
  reason: r.reason,
  requestedBy: r.requested_by ?? undefined,
  reviewedBy: r.reviewed_by ?? undefined,
  reviewNote: r.review_note ?? undefined,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at ?? undefined,
  executedAt: r.executed_at ?? undefined,
});

export async function createApproval(
  ctx: { req: NextRequest; workspaceId: string },
  input: Omit<ApprovalItem, "id" | "workspaceId" | "createdAt" | "reviewedAt" | "executedAt" | "reviewedBy">
) {
  const [row] = await supabaseRest<UnknownRecord[]>(ctx.req, "action_approvals", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: ctx.workspaceId,
      action_type: input.actionType,
      risk: input.risk,
      status: input.status,
      target_id: input.targetId ?? null,
      payload: input.payload,
      reason: input.reason,
      requested_by: input.requestedBy ?? null,
      review_note: input.reviewNote ?? null,
    }),
    headers: { Prefer: "return=representation" },
  });
  return map(row);
}

export async function listApprovals(ctx: { req: NextRequest; workspaceId: string }, status?: string) {
  const params: Record<string, string> = {
    workspace_id: `eq.${ctx.workspaceId}`,
    order: "created_at.desc",
    limit: "100",
  };
  if (status) params.status = `eq.${status}`;
  const rows = await supabaseRest<UnknownRecord[]>(ctx.req, "action_approvals", {}, q(params));
  return rows.map(map);
}

export async function reviewApproval(
  ctx: { req: NextRequest; workspaceId: string; reviewerId: string },
  id: string,
  decision: "approved" | "rejected",
  reviewNote?: string
) {
  const [row] = await supabaseRest<UnknownRecord[]>(
    ctx.req,
    "action_approvals",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: decision,
        reviewed_by: ctx.reviewerId,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote ?? null,
      }),
      headers: { Prefer: "return=representation" },
    },
    q({ workspace_id: `eq.${ctx.workspaceId}`, id: `eq.${id}`, status: "eq.pending" })
  );
  return row ? map(row) : null;
}
