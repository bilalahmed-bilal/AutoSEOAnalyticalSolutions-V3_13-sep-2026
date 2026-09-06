export type OptimizationField = "title" | "metaDescription" | "h1" | "body";
export type VersionStatus = "proposed" | "approved" | "rejected" | "applied" | "rolled_back";

export interface OptimizedSnapshot {
  title: string;
  metaDescription: string;
  h1: string;
  body: string;
}

export interface ChangeDecision {
  field: OptimizationField;
  accepted: boolean;
  rationale?: string;
}

export function normalizeSnapshot(input: Partial<OptimizedSnapshot>): OptimizedSnapshot {
  return {
    title: String(input.title ?? ""),
    metaDescription: String(input.metaDescription ?? ""),
    h1: String(input.h1 ?? ""),
    body: String(input.body ?? ""),
  };
}

export function buildInitialDecisions(original: OptimizedSnapshot, optimized: OptimizedSnapshot): ChangeDecision[] {
  return (Object.keys(original) as OptimizationField[]).map((field) => ({
    field,
    accepted: original[field] !== optimized[field],
  }));
}

export function applyDecisions(original: OptimizedSnapshot, optimized: OptimizedSnapshot, decisions: ChangeDecision[]): OptimizedSnapshot {
  const accepted = new Set(decisions.filter((d) => d.accepted).map((d) => d.field));
  return (Object.keys(original) as OptimizationField[]).reduce((out, field) => {
    out[field] = accepted.has(field) ? optimized[field] : original[field];
    return out;
  }, {} as OptimizedSnapshot);
}
