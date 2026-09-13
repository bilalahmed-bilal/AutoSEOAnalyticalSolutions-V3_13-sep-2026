# Nexora — Integration & Setup Notes

Customer-facing product name: **Nexora**. Internal engineering names and some
example paths may still say AutoSEO.

Live Google/Meta OAuth round-trips are **REQUIRES_CONFIGURATION** until executed
in a configured environment. Facebook OAuth is **FIRST_PAGE_ONLY**.

## YouTube and Facebook connections

Website (WordPress/Custom Site) ke bar-aks, YouTube aur Facebook ke liye
pehle **Google/Meta ke sath apna app register karna** parta hai — ye Anthropic
ya Nexora nahi, Google/Meta khud maangte hain kisi bhi third-party tool se
jo unki API use kare. Ye ek-baar ka Cloud/Meta app setup hai.

YouTube users then connect **inside Nexora** with **Connect with Google OAuth**.
Do not use OAuth Playground to paste tokens for normal use.

## YouTube (in-app Google OAuth)

Database connections store provider as **`youtube`**. The OAuth start/callback
routes use **`google-youtube`**. Token refresh maps `youtube` → Google YouTube
OAuth config without renaming the stored provider.

1. **console.cloud.google.com** pe ek project banayein.
2. Enable **YouTube Data API v3** and **YouTube Analytics API**.
3. Create an **OAuth 2.0 Client ID** (Web application).
4. Authorized redirect URI:
   `{NEXT_PUBLIC_APP_URL}/api/oauth/callback/google-youtube`
5. OAuth consent screen pe ye scopes allow karein (Nexora yahi request karta hai):
   - `https://www.googleapis.com/auth/youtube.force-ssl` — existing video metadata
   - `https://www.googleapis.com/auth/yt-analytics.readonly` — Analytics reports
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_APP_URL` in `.env.local`.
7. In Nexora Publish/settings, click **Connect with Google OAuth**. Google issues
   an access token and refresh token; Nexora stores them encrypted on the
   `youtube` connection.

Existing YouTube connections authorized **before** Analytics access was requested
must click **Connect with Google OAuth** again. Refreshing an old token does not
add missing scopes. Nexora does not treat those tokens as if they have Analytics
permission.

**Legacy/testing-only:** a manual access-token field still exists for local
testing. Those tokens do not refresh and often lack Analytics access. Do not use
them in production.

## Facebook (Meta for Developers)

1. **developers.facebook.com** pe ja kar apna account banayein aur ek naya app create karein (type: "Business").
2. App Dashboard mein "Facebook Login" product add karein.
3. Nexora includes an in-app **Connect with Facebook OAuth** button (`/api/oauth/facebook`).
   This beta connects the **first Page only** (`FIRST_PAGE_ONLY`).
4. Page Access Token paste, if used, is a **legacy/testing** path:
   - **Graph API Explorer** (developers.facebook.com/tools/explorer)
   - permissions `pages_manage_posts` aur `pages_read_engagement`
   - "Get Token" → "Get Page Access Token"
5. Apna **Page ID** apne Facebook Page ki "About" section se ya Graph API Explorer se mil jayega.

**Note:** Live Google/Meta OAuth round-trips are environment-specific and are not
claimed verified here.

## custom-site-receiver-example

# Custom Site Receiver — Example for a Next.js site (like KSTS)

Copy this file into **your own website's project** (not the AutoSEO project) at:

```
app/api/autoseo-publish/route.ts
```

Then in AutoSEO's "Publish" tab, choose "Custom Site API" and set:
- **Webhook URL:** `https://your-site.com/api/autoseo-publish`
- **API Key:** any long random string YOU generate — put the same value in
  your site's `.env.local` as `AUTOSEO_API_KEY`, and paste it into AutoSEO's
  Publish tab too. This is the shared secret that stops random people from
  posting to your site.

## Two actions this endpoint should handle

AutoSEO sends a request with an `"action"` field. Your endpoint decides
internally how to fulfill each one — AutoSEO never sees your database or
source code, only whatever this endpoint chooses to do.

- **`"create_content"`** (Phase 3): publish a brand-new page/post.
- **`"update_seo_fields"`** (advanced fixing): apply generated fixes — title,
  meta description, suggested headings, schema.org JSON-LD — to an
  **existing** page, identified by `targetUrl`. This is what lets AutoSEO's
  SEO Analyzer actually fix the issues it finds, not just report them,
  without ever needing access to your site's source code.

If you don't want to support `update_seo_fields` yet, just return a `501`
status for that action — AutoSEO will show the user a clear message instead
of failing silently.

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 1. Check the shared secret
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.AUTOSEO_API_KEY}`;
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // AutoSEO sends a lightweight { ping: true } first, just to test the
  // connection — always return 200 for that without doing anything else.
  if (body.ping) {
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_content") {
    const { title, body: content, metaDescription } = body as {
      title: string;
      body: string;
      metaDescription?: string;
    };

    // TODO: replace with your actual save logic — e.g.:
    //   await db.posts.create({ title, content, metaDescription });
    console.log("Creating new content:", { title, content, metaDescription });

    return NextResponse.json({ link: "https://your-site.com/blog/some-slug" });
  }

  if (body.action === "update_seo_fields") {
    const { targetUrl, title, metaDescription, suggestedHeadings, schemaJsonLd } = body as {
      targetUrl: string;
      title: string;
      metaDescription: string;
      suggestedHeadings?: string[];
      schemaJsonLd?: string;
    };

    // TODO: look up the existing page by targetUrl in YOUR database/CMS and
    // update its title/meta fields. This is entirely up to how KSTS actually
    // stores pages — e.g.:
    //   const page = await db.pages.findByUrl(targetUrl);
    //   await db.pages.update(page.id, { title, metaDescription });
    //
    // For suggestedHeadings and schemaJsonLd: these are advisory — apply them
    // if/how it makes sense for your page structure (e.g. inject the
    // schemaJsonLd as a <script type="application/ld+json"> in that page's
    // <head>, or store suggestedHeadings for manual review before restructuring
    // page content). Don't apply blindly if it could break page layout.
    console.log("Updating SEO fields for:", targetUrl, {
      title,
      metaDescription,
      suggestedHeadings,
      schemaJsonLd,
    });

    return NextResponse.json({ link: targetUrl });

    // If you haven't implemented this yet, return instead:
    // return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
```

**Security note:** keep `AUTOSEO_API_KEY` out of your git repo (put it in
`.env.local`, which is already gitignored by default in a Next.js project).
Anyone with this key can publish content or modify pages on your site through
this endpoint, so treat it like a password.

**Why this design keeps your site safe:** AutoSEO calling this endpoint is
fundamentally different from giving AutoSEO your GitHub repo or server
access. You choose exactly which two actions exist, you write the code that
runs for each one, and you can revoke the API key at any time to cut off
access instantly — none of that is true if a tool has your actual source
code or database credentials.
