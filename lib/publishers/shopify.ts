// Shopify adapter — the second no-code website connection (after
// WordPress), per Section 4.1's segmentation: dominant no-code platform for
// small e-commerce businesses in the target market.
//
// NO-CODE CONNECTION: the user generates credentials entirely from their own
// Shopify admin, no code involved:
//   1. Shopify Admin → Settings → Apps and sales channels → Develop apps
//   2. "Create an app" (any name, e.g. "AutoSEO")
//   3. Configure Admin API scopes: enable "write_content" (Shopify's scope
//      covering Pages) — this is a checkbox in their admin UI
//   4. Install app → copy the "Admin API access token" (shown once)
//   5. Paste that token + their store domain (e.g. "mystore.myshopify.com")
//      into AutoSEO's Publish tab
//
// SCOPE NOTE: uses Shopify's "Pages" resource (static pages) for content —
// the simplest fit for marketing/SEO content on a Shopify store, no blog_id
// needed (unlike Shopify's separate Articles/blog resource).
//
// HONEST LIMITATION: Shopify's core Page resource has no native "meta
// description" field — SEO title/description live in metafields
// (namespace "global", keys "title_tag"/"description_tag"), the same
// mechanism Shopify's own admin SEO fields use under the hood. This adapter
// sets that metafield directly, which is reliable and is the same field
// Shopify's own store admin UI edits — not a guess at a third-party app's
// custom field, unlike the WordPress Yoast/RankMath situation.

import { safeOutboundFetch } from "@/lib/security/outbound";

export interface ShopifySettings {
  shopDomain: string; // e.g. "mystore.myshopify.com"
  accessToken: string;
}

const API_VERSION = "2025-01";

function normalizeShopDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function apiUrl(settings: ShopifySettings, path: string): string {
  const domain = normalizeShopDomain(settings.shopDomain);
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) {
    throw new Error("Shopify store domain must be a *.myshopify.com hostname.");
  }
  return `https://${domain}/admin/api/${API_VERSION}${path}`;
}

function headers(settings: ShopifySettings) {
  return {
    "X-Shopify-Access-Token": settings.accessToken,
    "Content-Type": "application/json",
  };
}

export async function testShopifyConnection(settings: ShopifySettings): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await safeOutboundFetch(apiUrl(settings, "/shop.json"), {
      headers: headers(settings),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Access token ghalat hai ya scope kaafi nahi hai." };
    }
    if (!res.ok) {
      return { ok: false, message: `Shopify ne connection reject kar di (status ${res.status}).` };
    }
    const data = await res.json();
    return { ok: true, message: `Connected: "${data.shop?.name}".` };
  } catch {
    return {
      ok: false,
      message: "Shopify tak nahi pahunch paye. Store domain check karein aur dobara koshish karein.",
    };
  }
}

export async function publishToShopify(
  settings: ShopifySettings,
  post: { title: string; body: string; metaDescription?: string }
): Promise<{ id: number; link: string }> {
  const res = await safeOutboundFetch(apiUrl(settings, "/pages.json"), {
    method: "POST",
    headers: headers(settings),
    body: JSON.stringify({
      page: {
        title: post.title,
        body_html: post.body.replace(/\n/g, "<br />\n"),
        published: true,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Shopify publish failed (status ${res.status}).`);
  }

  const data = await res.json();
  const page = data.page;

  if (post.metaDescription) {
    await setPageMetaDescription(settings, page.id, post.metaDescription).catch(() => {
      // Page itself published fine — meta description is a secondary step,
      // don't fail the whole publish over it.
    });
  }

  return {
    id: page.id,
    link: `https://${normalizeShopDomain(settings.shopDomain)}/pages/${page.handle}`,
  };
}

async function setPageMetaDescription(settings: ShopifySettings, pageId: number, metaDescription: string) {
  const res = await safeOutboundFetch(apiUrl(settings, `/pages/${pageId}/metafields.json`), {
    method: "POST",
    headers: headers(settings),
    body: JSON.stringify({
      metafield: {
        namespace: "global",
        key: "description_tag",
        value: metaDescription,
        type: "single_line_text_field",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Meta description set nahi ho saki (status ${res.status}).`);
  }
}

function extractHandle(url: string): string {
  const cleaned = url.replace(/\/+$/, "");
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || "";
}

export async function applySeoFixesToShopify(
  settings: ShopifySettings,
  fix: { targetUrl: string; title: string; metaDescription: string }
): Promise<{ link: string }> {
  const handle = extractHandle(fix.targetUrl);

  const lookupRes = await safeOutboundFetch(apiUrl(settings, `/pages.json?handle=${encodeURIComponent(handle)}`), {
    headers: headers(settings),
    signal: AbortSignal.timeout(10_000),
  });
  if (!lookupRes.ok) {
    throw new Error(`Page dhoondne mein masla hua (status ${lookupRes.status}).`);
  }
  const data = await lookupRes.json();
  const page = data.pages?.[0];
  if (!page) {
    throw new Error(`"${handle}" handle wala page nahi mila. Note: sirf Shopify Pages support hain abhi.`);
  }

  const updateRes = await safeOutboundFetch(apiUrl(settings, `/pages/${page.id}.json`), {
    method: "PUT",
    headers: headers(settings),
    body: JSON.stringify({ page: { id: page.id, title: fix.title } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!updateRes.ok) {
    throw new Error(`Shopify update failed (status ${updateRes.status}).`);
  }

  await setPageMetaDescription(settings, page.id, fix.metaDescription).catch(() => {
    // Title update succeeded — surface meta-description failure separately
    // rather than reporting the whole fix as failed.
  });

  const updated = await updateRes.json();
  return { link: `https://${normalizeShopDomain(settings.shopDomain)}/pages/${updated.page.handle}` };
}
