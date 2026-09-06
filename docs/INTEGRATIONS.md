# AutoSEO — Integration & Setup Notes

## youtube-facebook-setup

# YouTube aur Facebook Setup Guide

Website (WordPress/Custom Site) ke bar-aks, YouTube aur Facebook ke liye
pehle **Google/Meta ke sath apna app register karna** parta hai — ye Anthropic
ya AutoSEO nahi, Google/Meta khud maangte hain kisi bhi third-party tool se
jo unki API use kare. Ye ek-baar ka setup hai.

## YouTube (Google Cloud Console)

1. **console.cloud.google.com** pe ja kar ek naya project banayein.
2. "APIs & Services" → "Library" mein ja kar **"YouTube Data API v3"** enable karein.
3. "Credentials" mein ja kar **OAuth 2.0 Client ID** banayein (Application type: "Web application").
4. **OAuth consent screen** setup karein — scope mein `https://www.googleapis.com/auth/youtube.force-ssl` add karein.
5. Is Client ID/Secret se **OAuth flow** chalayein taake ek **access token** mil sake — sabse asaan tareeka:
   - Google ka **OAuth 2.0 Playground** (developers.google.com/oauthplayground) use karein: apna Client ID/Secret daalein (settings gear icon se "Use your own OAuth credentials"), phir YouTube Data API v3 scope select kar ke authorize karein — ye aapko ek access token de dega jo aap AutoSEO ke "Publish" tab mein paste kar sakte hain.
   - **Note:** Ye tokens **expire ho jate hain** (usually 1 ghante mein) — production ke liye "refresh token" flow implement karna hoga (Phase 5 ka kaam), abhi ke liye testing ke liye manually renew karte rahein.

## Facebook (Meta for Developers)

1. **developers.facebook.com** pe ja kar apna account banayein aur ek naya app create karein (type: "Business").
2. App Dashboard mein "Facebook Login" product add karein.
3. Apne Facebook Page ke liye **Page Access Token** generate karein:
   - **Graph API Explorer** (developers.facebook.com/tools/explorer) use karein
   - Apna app select karein, permissions mein `pages_manage_posts` aur `pages_read_engagement` add karein
   - "Get Token" → "Get Page Access Token" se apne page ka token generate karein
4. Apna **Page ID** apne Facebook Page ki "About" section se ya Graph API Explorer se mil jayega.
5. Ye Page ID aur Page Access Token AutoSEO ke "Publish" tab mein paste karein.

**Note:** Page Access Tokens ko "never expire" (long-lived) bhi banaya ja sakta hai Meta ke token-exchange endpoint se — production ke liye ye zaroori hoga.

## Production ke liye (baad mein)

Abhi ye process manual hai (aap khud token generate kar ke paste karte hain).
Jab ye tool doosre users ko subscription pe dena ho (jaisa aapne pehle bataya
tha), tab **poora OAuth "Connect with Google" / "Connect with Facebook"
button flow** banana hoga taake har user khud apna account connect kar sake
bina manually token copy-paste kiye — ye Phase 5 ka kaam hai.

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
