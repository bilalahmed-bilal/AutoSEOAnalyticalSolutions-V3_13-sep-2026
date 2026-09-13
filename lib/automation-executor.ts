import type { NextRequest } from "next/server";
import { listKeywordOpportunities } from "@/lib/keyword-research-repository";
import { generateKeywordCandidates } from "@/lib/keyword-research";
import { analyzeCompetitors } from "@/lib/competitor-intelligence";
import { buildContentStrategy } from "@/lib/content-strategy";
import { evaluateContent } from "@/lib/content-quality";
import { runTechnicalAudit } from "@/lib/technical-seo";
import { analyzeSiteArchitecture } from "@/lib/site-architecture/engine";
import { analyzeLocalSeo } from "@/lib/local-seo/engine";
import type { WorkflowStep } from "@/lib/automation-workflows";
import { errorMessage, type UnknownRecord } from "@/lib/unknown";

export async function executeWorkflowSteps(
  ctx: { req: NextRequest; workspaceId: string },
  steps: WorkflowStep[],
  input: Record<string, unknown>
) {
  const results: UnknownRecord[] = [];
  let keywords: UnknownRecord[] = [];
  const targetUrl = typeof input.targetUrl === "string" ? input.targetUrl.trim() : "";
  if (typeof input.keywordProjectId === "string" && input.keywordProjectId)
    keywords = await listKeywordOpportunities(ctx, input.keywordProjectId);
  for (const step of steps.filter((s) => s.enabled)) {
    const started = Date.now();
    try {
      let output: UnknownRecord;
      if (step.type === "keyword_research") {
        const seed = String(input.seedKeyword || step.input?.seedKeyword || "").trim();
        if (!seed) throw new Error("Keyword Research step requires seedKeyword.");
        output = {
          candidates: generateKeywordCandidates(
            seed,
            null,
            Array.isArray(input.gscQueries) ? input.gscQueries.map(String) : []
          ),
        };
      } else if (step.type === "competitor_analysis") {
        if (!targetUrl) throw new Error("Competitor step requires targetUrl.");
        const urls = Array.isArray(input.competitorUrls)
          ? input.competitorUrls.filter((x): x is string => typeof x === "string")
          : [];
        if (!urls.length) throw new Error("Competitor step requires competitorUrls.");
        output = await analyzeCompetitors(targetUrl, urls, keywords, Number(input.maxPages) || 12);
      } else if (step.type === "content_strategy") {
        if (!keywords.length)
          throw new Error("Content Strategy step requires keywordProjectId with saved opportunities.");
        const gaps = results.flatMap((r) => (Array.isArray(r.output?.keywordGaps) ? r.output.keywordGaps : []));
        output = buildContentStrategy(keywords, gaps);
      } else if (step.type === "content_quality") {
        const body = String(input.body || "");
        if (!body) throw new Error("Content Quality step requires body.");
        output = evaluateContent({
          title: String(input.title || ""),
          body,
          metaDescription: String(input.metaDescription || ""),
          keyword: String(input.keyword || ""),
          language: String(input.language || "en"),
          channel: String(input.channel || "website"),
          referenceTexts: Array.isArray(input.referenceTexts) ? input.referenceTexts.map(String) : [],
          businessFacts: Array.isArray(input.businessFacts) ? input.businessFacts.map(String) : [],
        });
      } else if (step.type === "technical_seo") {
        if (!targetUrl) throw new Error("Technical SEO step requires targetUrl.");
        output = await runTechnicalAudit(targetUrl, Number(input.maxPages) || 25);
      } else if (step.type === "site_architecture") {
        if (!targetUrl) throw new Error("Site Architecture step requires targetUrl.");
        output = await analyzeSiteArchitecture(targetUrl, keywords, Number(input.maxPages) || 30);
      } else if (step.type === "local_seo") {
        if (!targetUrl || typeof input.location !== "string" || !input.location.trim())
          throw new Error("Local SEO step requires targetUrl and location.");
        output = await analyzeLocalSeo(
          targetUrl,
          input.location.trim(),
          typeof input.businessName === "string" ? input.businessName.trim() : undefined,
          keywords,
          Number(input.maxPages) || 25
        );
      }
      results.push({ stepId: step.id, type: step.type, status: "succeeded", durationMs: Date.now() - started, output });
    } catch (e: unknown) {
      results.push({
        stepId: step.id,
        type: step.type,
        status: "failed",
        durationMs: Date.now() - started,
        error: String(errorMessage(e, "") || e),
      });
    }
  }
  return results;
}
