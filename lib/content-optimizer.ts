import type { CrawlResult } from "@/lib/seo-crawler";
import type { ContentIntelligenceResult } from "@/lib/content-intelligence";
import { optimizeContentWithAI, type OptimizedContent } from "@/lib/claude";

export interface OptimizationInput {
  crawl: CrawlResult;
  intelligence: ContentIntelligenceResult;
  preserveFactsOnly?: boolean;
}

export function buildOptimizationBrief(input: OptimizationInput) {
  const { crawl, intelligence } = input;
  return {
    url: crawl.url,
    keyword: intelligence.keyword,
    intent: intelligence.intent,
    score: intelligence.score,
    current: {
      title: crawl.title,
      metaDescription: crawl.metaDescription,
      h1s: crawl.h1s,
      wordCount: crawl.wordCount,
      readableText: crawl.readableText.slice(0, 18000),
    },
    gaps: intelligence.gaps,
    semanticTerms: intelligence.metrics.semanticTerms.slice(0, 15),
    recommendations: intelligence.recommendations,
    constraints: {
      preserveFactsOnly: input.preserveFactsOnly !== false,
      doNotInventPricesReviewsRatingsClaims: true,
      keepKeywordNatural: true,
    },
  };
}

export async function optimizeContent(input: OptimizationInput): Promise<OptimizedContent> {
  return optimizeContentWithAI(buildOptimizationBrief(input));
}
