// Second publish adapter, alongside lib/publishers/wordpress.ts (Section
// 5.2's adapter pattern). Deliberately generic — works with ANY website,
// including custom-coded ones like KSTS (Next.js) that have no standard
// content API. The site owner adds one small "receiver" endpoint to their
// own project (see docs/custom-site-receiver-example.md) and decides
// internally what each action actually does. AutoSEO never sees or needs
// the site's source code or database — only this one endpoint + a shared
// secret, which the owner controls entirely (they choose which actions,
// if any, their endpoint actually implements).
//
// Two actions are defined:
//   - "create_content": publish a new page/post (Phase 3's original use case)
//   - "update_seo_fields": apply advanced-level fixes to an EXISTING page —
//     title, meta description, suggested headings, schema.org JSON-LD — the
//     output of the SEO Analyzer's "Generate Fixes" feature. This is what
//     makes full advanced fixing possible without AutoSEO ever touching the
//     site's actual source code or database.
// A receiver only needs to implement the actions it wants to support; an
// unimplemented action should return a 501 so AutoSEO can report that
// clearly rather than silently failing.

import { safeOutboundFetch } from "@/lib/security/outbound";

export interface CustomSiteSettings {
  webhookUrl: string;
  apiKey: string;
}

async function callReceiver(settings: CustomSiteSettings, payload: object) {
  return safeOutboundFetch(settings.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
}

export async function testCustomSiteConnection(
  settings: CustomSiteSettings
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await callReceiver(settings, { ping: true });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "The API key is invalid — the receiver rejected the request." };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `The receiver endpoint returned an error (status ${res.status}). Check the endpoint code.`,
      };
    }
    return { ok: true, message: "Connection successful." };
  } catch {
    return {
      ok: false,
      message: "Could not reach the webhook URL. Check the URL and try again.",
    };
  }
}

export async function publishToCustomSite(
  settings: CustomSiteSettings,
  post: { title: string; body: string; metaDescription?: string }
): Promise<{ link?: string }> {
  const res = await callReceiver(settings, {
    action: "create_content",
    title: post.title,
    body: post.body,
    metaDescription: post.metaDescription,
  });

  if (!res.ok) {
    throw new Error(`Custom site publish failed (status ${res.status}).`);
  }

  const data = await res.json().catch(() => ({}));
  return { link: data.link };
}

export async function applySeoFixesToCustomSite(
  settings: CustomSiteSettings,
  fix: {
    targetUrl: string;
    title: string;
    metaDescription: string;
    suggestedHeadings?: string[];
    schemaJsonLd?: string;
  }
): Promise<{ link?: string }> {
  const res = await callReceiver(settings, {
    action: "update_seo_fields",
    targetUrl: fix.targetUrl,
    title: fix.title,
    metaDescription: fix.metaDescription,
    suggestedHeadings: fix.suggestedHeadings,
    schemaJsonLd: fix.schemaJsonLd,
  });

  if (res.status === 501) {
    throw new Error(
      "This site's receiver endpoint has not implemented the 'update_seo_fields' action — only create_content is supported at this time."
    );
  }
  if (!res.ok) {
    throw new Error(`Could not apply the SEO fix (status ${res.status}).`);
  }

  const data = await res.json().catch(() => ({}));
  return { link: data.link || fix.targetUrl };
}
