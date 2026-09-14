/**
 * Customer-facing AIBISORA branding.
 *
 * Internal engineering identifiers may still say AutoSEO or Nexora
 * (env keys, cookies, SQL filenames, worker headers). Those are legacy
 * internals — do not surface them as the current product name.
 */
export const productBrand = {
  productName: "AIBISORA",
  brandName: "AIBISORA",
  logo: "/aibisora-mark.svg",
  logoLight: "/aibisora-mark-light.svg",
  favicon: "/favicon.svg",
  ogImage: "/og.png",
  supportEmail: process.env.AIBISORA_SUPPORT_EMAIL || process.env.NEXORA_SUPPORT_EMAIL || "support@aibisora.local",
  websiteUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  defaultLanguage: "en",
  defaultTimezone: "UTC",
  legalBusinessName: process.env.AIBISORA_LEGAL_BUSINESS_NAME || process.env.NEXORA_LEGAL_BUSINESS_NAME || "AIBISORA",
  tagline: "From Web to Social, Your Complete Business Solution.",
  description:
    "AIBISORA is an AI-powered business growth platform for websites, SEO, content, YouTube, and Facebook — with Instagram and WhatsApp on the roadmap. Discover, analyze, recommend, create, approve, publish, and measure. Humans stay in control of what goes live.",
} as const;

export function brandSiteUrl(): URL {
  try {
    return new URL(productBrand.websiteUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export type ProductBrand = typeof productBrand;
