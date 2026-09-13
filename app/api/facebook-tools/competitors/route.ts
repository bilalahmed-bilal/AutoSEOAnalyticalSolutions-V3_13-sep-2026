import { NextRequest, NextResponse } from "next/server";
import { isFacebookSecurityContext, requireFacebookAccess } from "@/lib/facebook-security";
import { fetchPublicPageStats } from "@/lib/publishers/facebook";
import { errorMessage } from "@/lib/unknown";
import { sameOriginWrite } from "@/lib/security/request";
import {
  addSocialCompetitor,
  listSocialCompetitors,
  removeSocialCompetitor,
} from "@/lib/social-competitors-repository";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function GET(req: NextRequest) {
  const entitled = await requireProductAccess(req, { feature: "facebook.analytics", minRole: "viewer" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "viewer");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const tracked = await listSocialCompetitors({ req, workspaceId: access.workspaceId }, "facebook");
    const results = await Promise.all(
      tracked.map(async (c) => {
        try {
          const stats = await fetchPublicPageStats(access.settings, c.channelIdOrHandle);
          return { id: c.id, ...stats };
        } catch (err: unknown) {
          return { id: c.id, pageId: c.channelIdOrHandle, error: errorMessage(err) };
        }
      })
    );
    return NextResponse.json({ pages: results });
  } catch {
    return NextResponse.json({ error: "Competitor data load nahi ho saka." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, { feature: "facebook.connect", minRole: "editor" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "editor");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const { pageIdOrUsername } = (await req.json()) as { pageIdOrUsername?: string };
    if (!pageIdOrUsername?.trim()) {
      return NextResponse.json({ error: "Page ID ya username batana zaroori hai." }, { status: 400 });
    }
    const entry = await addSocialCompetitor(
      { req, workspaceId: access.workspaceId },
      "facebook",
      pageIdOrUsername.trim()
    );
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: "Add nahi ho saka." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, { feature: "facebook.connect", minRole: "admin" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "admin");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "ID zaroori hai." }, { status: 400 });
    await removeSocialCompetitor({ req, workspaceId: access.workspaceId }, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Remove nahi ho saka." }, { status: 500 });
  }
}
