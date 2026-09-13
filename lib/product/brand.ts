/** Customer-facing Nexora branding. Internal modules may still say AutoSEO. */
export const productBrand = {
  productName: "Nexora",
  brandName: "Nexora",
  logo: "/nexora-mark.svg",
  favicon: "/favicon.ico",
  supportEmail: process.env.NEXORA_SUPPORT_EMAIL || "support@nexora.local",
  websiteUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  defaultLanguage: "en",
  defaultTimezone: "Asia/Karachi",
  legalBusinessName: process.env.NEXORA_LEGAL_BUSINESS_NAME || "Nexora",
  tagline: "AI-powered SEO, content, and marketing automation",
  description:
    "Nexora helps teams discover, analyze, recommend, create, approve, publish, and measure SEO and marketing work across websites, YouTube, and Facebook.",
} as const;

export type ProductBrand = typeof productBrand;
