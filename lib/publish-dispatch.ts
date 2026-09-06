import { type ContentDraft } from "@/lib/store";
import type { NextRequest } from "next/server";
import { getPublishSettingsRemote } from "@/lib/store-repository";
import { publishToWordPress, applySeoFixesToWordPress } from "@/lib/publishers/wordpress";
import { publishToShopify, applySeoFixesToShopify } from "@/lib/publishers/shopify";
import { publishToCustomSite, applySeoFixesToCustomSite } from "@/lib/publishers/custom-site";
import { updateYouTubeVideo } from "@/lib/publishers/youtube";
import { publishToFacebook } from "@/lib/publishers/facebook";

// Central place that decides "this draft is for channel X (and kind Y), so
// call adapter X's matching function" — used by both the manual approve
// route and the auto-publish path, so the two never drift out of sync.

export async function publishDraftWithSettings(draft: ContentDraft, settings: Awaited<ReturnType<typeof getPublishSettingsRemote>>): Promise<string | undefined> {

  if (draft.channel === "website") {
    if (!settings.website) throw new Error("Website connect nahi hai.");

    if (draft.kind === "seo_fix") {
      if (!draft.targetUrl) throw new Error("Target URL missing hai.");
      if (settings.website.platformType === "wordpress" && settings.website.wordpress) {
        const result = await applySeoFixesToWordPress(settings.website.wordpress, {
          targetUrl: draft.targetUrl,
          title: draft.title,
          metaDescription: draft.metaDescription || "",
        });
        return result.link;
      }
      if (settings.website.platformType === "shopify" && settings.website.shopify) {
        const result = await applySeoFixesToShopify(settings.website.shopify, {
          targetUrl: draft.targetUrl,
          title: draft.title,
          metaDescription: draft.metaDescription || "",
        });
        return result.link;
      }
      if (settings.website.platformType === "custom" && settings.website.custom) {
        const result = await applySeoFixesToCustomSite(settings.website.custom, {
          targetUrl: draft.targetUrl,
          title: draft.title,
          metaDescription: draft.metaDescription || "",
          suggestedHeadings: draft.suggestedHeadings,
          schemaJsonLd: draft.schemaJsonLd,
        });
        return result.link;
      }
      throw new Error("Website settings incomplete hain.");
    }

    // kind === "new_content"
    if (settings.website.platformType === "wordpress" && settings.website.wordpress) {
      const result = await publishToWordPress(settings.website.wordpress, {
        title: draft.title,
        body: draft.body,
        metaDescription: draft.metaDescription,
      });
      return result.link;
    }
    if (settings.website.platformType === "shopify" && settings.website.shopify) {
      const result = await publishToShopify(settings.website.shopify, {
        title: draft.title,
        body: draft.body,
        metaDescription: draft.metaDescription,
      });
      return result.link;
    }
    if (settings.website.platformType === "custom" && settings.website.custom) {
      const result = await publishToCustomSite(settings.website.custom, {
        title: draft.title,
        body: draft.body,
        metaDescription: draft.metaDescription,
      });
      return result.link;
    }
    throw new Error("Website settings incomplete hain.");
  }

  if (draft.channel === "youtube") {
    if (!settings.youtube) throw new Error("YouTube connect nahi hai.");
    if (!draft.videoId) throw new Error("Video ID missing hai.");
    const result = await updateYouTubeVideo(settings.youtube.settings, draft.videoId, {
      title: draft.title,
      description: draft.body,
      tags: draft.metaDescription ? draft.metaDescription.split(",").map((t) => t.trim()) : undefined,
    });
    return result.link;
  }

  if (draft.channel === "facebook") {
    if (!settings.facebook) throw new Error("Facebook connect nahi hai.");
    const result = await publishToFacebook(settings.facebook.settings, { message: draft.body });
    return result.link;
  }

  throw new Error("Unknown channel.");
}

export async function publishDraftToChannel(draft: ContentDraft, ctx?: { req?: NextRequest; workspaceId?: string }): Promise<string | undefined> {
  const settings = await getPublishSettingsRemote(ctx ?? {});
  return publishDraftWithSettings(draft, settings);
}
