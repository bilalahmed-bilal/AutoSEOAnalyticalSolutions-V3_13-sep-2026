import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export type ExperimentStatus =
  | "draft"
  | "running_a"
  | "running_b"
  | "evaluating"
  | "winner_a"
  | "winner_b"
  | "inconclusive"
  | "promoted"
  | "stopped";
export interface Experiment {
  id: string;
  workspaceId: string;
  draftId: string;
  targetUrl: string;
  metric: string;
  status: ExperimentStatus;
  variantAVersionId: string;
  variantBVersionId: string;
  baselineStart?: string;
  baselineEnd?: string;
  variantAStart?: string;
  variantAEnd?: string;
  variantBStart?: string;
  variantBEnd?: string;
  minImpressions: number;
  minClicks: number;
  confidenceThreshold: number;
  minAbsoluteCtrLift: number;
  result: UnknownRecord;
  createdAt: string;
  updatedAt: string;
}
export interface Observation {
  id: string;
  experimentId: string;
  variant: "a" | "b" | "baseline";
  periodStart: string;
  periodEnd: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
  createdAt: string;
}
function map(r: UnknownRecord): Experiment {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    draftId: r.draft_id,
    targetUrl: r.target_url,
    metric: r.metric,
    status: r.status,
    variantAVersionId: r.variant_a_version_id,
    variantBVersionId: r.variant_b_version_id,
    baselineStart: r.baseline_start ?? undefined,
    baselineEnd: r.baseline_end ?? undefined,
    variantAStart: r.variant_a_start ?? undefined,
    variantAEnd: r.variant_a_end ?? undefined,
    variantBStart: r.variant_b_start ?? undefined,
    variantBEnd: r.variant_b_end ?? undefined,
    minImpressions: r.min_impressions,
    minClicks: r.min_clicks,
    confidenceThreshold: Number(r.confidence_threshold),
    minAbsoluteCtrLift: Number(r.min_absolute_ctr_lift),
    result: r.result ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function mapObs(r: UnknownRecord): Observation {
  return {
    id: r.id,
    experimentId: r.experiment_id,
    variant: r.variant,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: Number(r.ctr),
    averagePosition: r.average_position == null ? null : Number(r.average_position),
    createdAt: r.created_at,
  };
}
export async function listExperiments(workspaceId: string) {
  return (
    await supabaseAdmin<UnknownRecord[]>(
      "seo_experiments",
      {},
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc`
    )
  ).map(map);
}
export async function getExperiment(workspaceId: string, id: string) {
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "seo_experiments",
    {},
    `?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ? map(rows[0]) : null;
}
export async function createExperiment(input: {
  workspaceId: string;
  draftId: string;
  targetUrl: string;
  variantAVersionId: string;
  variantBVersionId: string;
  metric?: string;
  minImpressions?: number;
  minClicks?: number;
  confidenceThreshold?: number;
  minAbsoluteCtrLift?: number;
  createdBy?: string;
}) {
  const [r] = await supabaseAdmin<UnknownRecord[]>("seo_experiments", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      draft_id: input.draftId,
      target_url: input.targetUrl,
      metric: input.metric ?? "ctr",
      variant_a_version_id: input.variantAVersionId,
      variant_b_version_id: input.variantBVersionId,
      min_impressions: input.minImpressions ?? 100,
      min_clicks: input.minClicks ?? 10,
      confidence_threshold: input.confidenceThreshold ?? 0.95,
      min_absolute_ctr_lift: input.minAbsoluteCtrLift ?? 0.01,
      created_by: input.createdBy ?? null,
    }),
    headers: { Prefer: "return=representation" },
  });
  return r ? map(r) : null;
}
export async function updateExperiment(workspaceId: string, id: string, patch: Record<string, unknown>) {
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "seo_experiments",
    { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } },
    `?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}`
  );
  return rows[0] ? map(rows[0]) : null;
}
export async function listObservations(workspaceId: string, id: string) {
  return (
    await supabaseAdmin<UnknownRecord[]>(
      "experiment_observations",
      {},
      `?workspace_id=eq.${encodeURIComponent(workspaceId)}&experiment_id=eq.${encodeURIComponent(id)}&order=period_start.asc`
    )
  ).map(mapObs);
}
export async function upsertObservation(input: {
  workspaceId: string;
  experimentId: string;
  variant: "a" | "b" | "baseline";
  periodStart: string;
  periodEnd: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number | null;
}) {
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "experiment_observations",
    {
      method: "POST",
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        experiment_id: input.experimentId,
        variant: input.variant,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        clicks: input.clicks,
        impressions: input.impressions,
        ctr: input.ctr,
        average_position: input.averagePosition,
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    },
    "?on_conflict=experiment_id,variant,period_start,period_end"
  );
  return rows[0] ? mapObs(rows[0]) : null;
}
