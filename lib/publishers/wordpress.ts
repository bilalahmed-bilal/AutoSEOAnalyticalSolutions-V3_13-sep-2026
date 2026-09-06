import type { WordPressSettings } from "@/lib/store";

// The first publish adapter (Section 5.2). Handles both creating new posts
// (Phase 3) and updating an existing post's title/excerpt for SEO fixes
// (advanced fixing feature).
//
// HONEST LIMITATION: WordPress core has no native "meta description" or
// "schema markup" REST field — those normally come from an SEO plugin
// (Yoast, RankMath), each with its own custom-field names. This adapter
// updates title and excerpt (the closest core equivalent to a meta
// description) reliably. Suggested headings and schema JSON-LD are
// returned to the UI for the user to paste in manually for WordPress sites,
// rather than silently guessing a plugin's custom-field name and possibly
// writing to the wrong place. A custom site's own receiver endpoint (see
// custom-site.ts) doesn't have this limitation — the owner decides exactly
// where that data goes.

function authHeader(settings: WordPressSettings): string {
  const token = Buffer.from(
    `${settings.username}:${settings.applicationPassword}`
  ).toString("base64");
  return `Basic ${token}`;
}

function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim().replace(/\/+$/, "");
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

export async function testWordPressConnection(
  settings: WordPressSettings
): Promise<{ ok: boolean; message: string }> {
  try {
    const base = normalizeSiteUrl(settings.siteUrl);
    const res = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authHeader(settings) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `WordPress ne connection reject kar di (status ${res.status}). Username/Application Password check karein.`,
      };
    }
    const user = await res.json();
    return { ok: true, message: `Connected as "${user.name}".` };
  } catch {
    return {
      ok: false,
      message: "Site tak nahi pahunch paye. Site URL check karein aur dobara koshish karein.",
    };
  }
}

export async function publishToWordPress(
  settings: WordPressSettings,
  post: { title: string; body: string; metaDescription?: string }
): Promise<{ id: number; link: string }> {
  const base = normalizeSiteUrl(settings.siteUrl);

  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader(settings),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: post.title,
      content: post.body.replace(/\n/g, "<br />\n"),
      status: "publish",
      excerpt: post.metaDescription || undefined,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress publish failed (status ${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { id: data.id, link: data.link };
}

function extractSlug(url: string): string {
  const cleaned = url.replace(/\/+$/, "");
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || "";
}

export async function applySeoFixesToWordPress(
  settings: WordPressSettings,
  fix: { targetUrl: string; title: string; metaDescription: string }
): Promise<{ link: string }> {
  const base = normalizeSiteUrl(settings.siteUrl);
  const slug = extractSlug(fix.targetUrl);

  const lookupRes = await fetch(`${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`, {
    headers: { Authorization: authHeader(settings) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!lookupRes.ok) {
    throw new Error(`Post dhoondne mein masla hua (status ${lookupRes.status}).`);
  }
  const matches = await lookupRes.json();
  if (!matches || matches.length === 0) {
    throw new Error(
      `"${slug}" slug wala post nahi mila. Note: sirf WordPress posts support hain, static pages ke liye slug match nahi ho sakta.`
    );
  }
  const postId = matches[0].id;

  const updateRes = await fetch(`${base}/wp-json/wp/v2/posts/${postId}`, {
    method: "PUT",
    headers: {
      Authorization: authHeader(settings),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: fix.title,
      excerpt: fix.metaDescription,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`WordPress update failed (status ${updateRes.status}): ${errText}`);
  }

  const data = await updateRes.json();
  return { link: data.link };
}
