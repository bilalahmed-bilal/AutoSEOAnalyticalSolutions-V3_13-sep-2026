export type RiskTier = "low" | "medium" | "high" | "critical";
export type ApprovalMode = "off" | "suggest" | "auto";

export type YouTubeActionType =
  | "draft_generation"
  | "metadata_suggestion"
  | "video_metadata_update"
  | "new_video_publish"
  | "bulk_metadata_update"
  | "delete_video";

export type RiskDecision = {
  actionType: YouTubeActionType;
  risk: RiskTier;
  requiredMode: ApprovalMode;
  autoExecutable: boolean;
  reason: string;
};

const riskByAction: Record<YouTubeActionType, RiskTier> = {
  draft_generation: "low",
  metadata_suggestion: "low",
  video_metadata_update: "medium",
  new_video_publish: "medium",
  bulk_metadata_update: "high",
  delete_video: "critical",
};

export function evaluateYouTubeRisk(
  actionType: YouTubeActionType,
  requestedMode: ApprovalMode = "suggest"
): RiskDecision {
  const risk = riskByAction[actionType];
  const requiredMode: ApprovalMode = risk === "low" ? requestedMode : risk === "medium" ? "suggest" : "suggest";
  const autoExecutable = risk === "low" && requestedMode === "auto";
  const reason =
    risk === "low"
      ? "Low-risk YouTube action may auto-execute when the workspace explicitly enables auto mode."
      : risk === "medium"
        ? "Medium-risk YouTube action requires an approval gate by default."
        : risk === "high"
          ? "High-risk bulk action always requires manual approval."
          : "Critical action is never auto-executable in this version.";
  return { actionType, risk, requiredMode, autoExecutable, reason };
}

export function approvalStatusFor(decision: RiskDecision, requestedMode: ApprovalMode): "auto" | "pending" | "blocked" {
  if (decision.risk === "critical") return "blocked";
  if (decision.autoExecutable && requestedMode === "auto") return "auto";
  return "pending";
}
