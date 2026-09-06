import { generateContentFromBrief, type ContentStudioResult, type Language } from "@/lib/claude";

export interface StudioBrief {
  businessName: string;
  niche: string;
  audience: string;
  tone: string;
  language: Language;
  channel: "website" | "youtube" | "facebook";
  keyword: string;
  intent: string;
  contentType: string;
  topic: string;
  suggestedTitle?: string;
  supportingKeywords?: string[];
  internalLinkTargets?: string[];
  competitorInsights?: string[];
}

export async function produceContent(brief: StudioBrief): Promise<ContentStudioResult> {
  return generateContentFromBrief(brief);
}
