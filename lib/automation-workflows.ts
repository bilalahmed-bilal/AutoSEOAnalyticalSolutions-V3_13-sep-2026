export type WorkflowStep = {
  id: string;
  type:
    | "keyword_research"
    | "competitor_analysis"
    | "content_strategy"
    | "content_quality"
    | "technical_seo"
    | "site_architecture"
    | "local_seo";
  enabled: boolean;
  input?: Record<string, unknown>;
};

export const WORKFLOW_STEP_LABELS: Record<WorkflowStep["type"], string> = {
  keyword_research: "Keyword Research",
  competitor_analysis: "Competitor Intelligence",
  content_strategy: "Content Strategy",
  content_quality: "Content Quality",
  technical_seo: "Technical SEO",
  site_architecture: "Internal Linking & Architecture",
  local_seo: "Local SEO",
};

export function normalizeSteps(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const x = raw as Record<string, unknown>;
    const type = String(x.type || "technical_seo") as WorkflowStep["type"];
    return {
      id: String(x.id || `${type}-${index + 1}`),
      type: WORKFLOW_STEP_LABELS[type] ? type : "technical_seo",
      enabled: x.enabled !== false,
      input: typeof x.input === "object" && x.input ? (x.input as Record<string, unknown>) : {},
    };
  });
}

export function validateWorkflowInput(input: { name: string; triggerType: string; schedule?: string; steps: unknown }) {
  if (!input.name.trim()) throw new Error("Workflow name is required.");
  if (!["manual", "schedule", "on_publish", "on_audit"].includes(input.triggerType))
    throw new Error("Invalid workflow trigger.");
  const steps = normalizeSteps(input.steps).filter((s) => s.enabled);
  if (!steps.length) throw new Error("At least one enabled workflow step is required.");
  if (steps.length > 12) throw new Error("A workflow can contain at most 12 steps.");
  if (input.triggerType === "schedule" && !input.schedule?.trim())
    throw new Error("Schedule is required for scheduled workflows.");
  return steps;
}
