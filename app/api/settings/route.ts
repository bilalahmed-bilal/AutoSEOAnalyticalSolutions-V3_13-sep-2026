import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { getPublishSettingsRemote, savePublishSettingsRemote } from "@/lib/store-repository";
import { getTenantContext } from "@/lib/tenant";
import { requireWorkspaceRole, isRoleResult } from "@/lib/auth/rbac";
import { testWordPressConnection } from "@/lib/publishers/wordpress";
import { testShopifyConnection } from "@/lib/publishers/shopify";
import { testCustomSiteConnection } from "@/lib/publishers/custom-site";
import { testYouTubeConnection } from "@/lib/publishers/youtube";
import { testFacebookConnection } from "@/lib/publishers/facebook";

export async function GET(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "viewer");
    if (!isRoleResult(permission)) return permission;
  }
  const tenant = access.authenticated ? await getTenantContext(req) : null;
  if (access.authenticated && !tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
  const settings = await getPublishSettingsRemote({ req, workspaceId: tenant?.workspaceId });
  // Never send secrets back to the client
  return NextResponse.json({
    oauth: { youtube: Boolean(settings.youtube), facebook: Boolean(settings.facebook) },
    website: settings.website
      ? {
          connected: true,
          platformType: settings.website.platformType,
          permission: settings.website.permission,
          siteUrl: settings.website.wordpress?.siteUrl,
          username: settings.website.wordpress?.username,
          webhookUrl: settings.website.custom?.webhookUrl,
          shopDomain: settings.website.shopify?.shopDomain,
        }
      : { connected: false },
    youtube: settings.youtube
      ? { connected: true, permission: settings.youtube.permission }
      : { connected: false },
    facebook: settings.facebook
      ? { connected: true, permission: settings.facebook.permission, pageId: settings.facebook.settings.pageId }
      : { connected: false },
  });
}

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  if (access.authenticated) {
    const permission = await requireWorkspaceRole(req, "admin");
    if (!isRoleResult(permission)) return permission;
  }
  try {
    const tenant = access.authenticated ? await getTenantContext(req) : null;
    if (access.authenticated && !tenant) return NextResponse.json({ error: "Valid x-workspace-id required." }, { status: 400 });
    const body = await req.json();
    const { platform, permission } = body;
    const perm = permission === "auto" ? "auto" : "suggest";

    if (platform === "website") {
      const { platformType, siteUrl, username, applicationPassword, webhookUrl, apiKey, shopDomain, accessToken: shopifyToken } = body;

      if (platformType === "wordpress") {
        if (!siteUrl || !username || !applicationPassword) {
          return NextResponse.json(
            { error: "Site URL, username, aur application password sab zaroori hain." },
            { status: 400 }
          );
        }
        const wordpress = { siteUrl, username, applicationPassword };
        const test = await testWordPressConnection(wordpress);
        if (!test.ok) return NextResponse.json({ error: test.message }, { status: 400 });
        await savePublishSettingsRemote({ req, workspaceId: tenant?.workspaceId }, { website: { platformType: "wordpress", wordpress, permission: perm } });
        return NextResponse.json({ ok: true, message: test.message });
      }

      if (platformType === "shopify") {
        if (!shopDomain || !shopifyToken) {
          return NextResponse.json(
            { error: "Store domain aur Admin API access token dono zaroori hain." },
            { status: 400 }
          );
        }
        const shopify = { shopDomain, accessToken: shopifyToken };
        const test = await testShopifyConnection(shopify);
        if (!test.ok) return NextResponse.json({ error: test.message }, { status: 400 });
        await savePublishSettingsRemote({ req, workspaceId: tenant?.workspaceId }, { website: { platformType: "shopify", shopify, permission: perm } });
        return NextResponse.json({ ok: true, message: test.message });
      }

      if (platformType === "custom") {
        if (!webhookUrl || !apiKey) {
          return NextResponse.json(
            { error: "Webhook URL aur API key dono zaroori hain." },
            { status: 400 }
          );
        }
        const custom = { webhookUrl, apiKey };
        const test = await testCustomSiteConnection(custom);
        if (!test.ok) return NextResponse.json({ error: test.message }, { status: 400 });
        await savePublishSettingsRemote({ req, workspaceId: tenant?.workspaceId }, { website: { platformType: "custom", custom, permission: perm } });
        return NextResponse.json({ ok: true, message: test.message });
      }

      return NextResponse.json({ error: "Website platform type batayein." }, { status: 400 });
    }

    if (platform === "youtube") {
      const { accessToken } = body;
      if (!accessToken) {
        return NextResponse.json({ error: "Access token zaroori hai." }, { status: 400 });
      }
      const settings = { accessToken };
      const test = await testYouTubeConnection(settings);
      if (!test.ok) return NextResponse.json({ error: test.message }, { status: 400 });
      await savePublishSettingsRemote({ req, workspaceId: tenant?.workspaceId }, { youtube: { settings, permission: perm } });
      return NextResponse.json({ ok: true, message: test.message });
    }

    if (platform === "facebook") {
      const { pageId, pageAccessToken } = body;
      if (!pageId || !pageAccessToken) {
        return NextResponse.json(
          { error: "Page ID aur Page Access Token dono zaroori hain." },
          { status: 400 }
        );
      }
      const settings = { pageId, pageAccessToken };
      const test = await testFacebookConnection(settings);
      if (!test.ok) return NextResponse.json({ error: test.message }, { status: 400 });
      await savePublishSettingsRemote({ req, workspaceId: tenant?.workspaceId }, { facebook: { settings, permission: perm } });
      return NextResponse.json({ ok: true, message: test.message });
    }

    return NextResponse.json({ error: "Platform batayein." }, { status: 400 });
  } catch (err) {
    console.error("settings save error:", err);
    return NextResponse.json({ error: "Settings save nahi ho sakein." }, { status: 500 });
  }
}
