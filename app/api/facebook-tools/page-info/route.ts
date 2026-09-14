import { NextRequest, NextResponse } from "next/server";
import { isFacebookSecurityContext, requireFacebookAccess } from "@/lib/facebook-security";
import { sameOriginWrite } from "@/lib/security/request";
import { fetchPageInfo, updatePageInfo } from "@/lib/publishers/facebook";
import { generatePageSeoFix } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { jsonPublicError } from "@/lib/security/public-error";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function GET(req: NextRequest) {
  const entitled = await requireProductAccess(req, { feature: "facebook.connect", minRole: "viewer" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "viewer");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const info = await fetchPageInfo(access.settings);
    return NextResponse.json({ info, pageSelection: "FIRST_PAGE_ONLY" });
  } catch (err: unknown) {
    return jsonPublicError(err, "Page info could not be fetched.");
  }
}

export async function POST(req: NextRequest) {
  if (!sameOriginWrite(req)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const entitled = await requireProductAccess(req, { feature: "facebook.publish", minRole: "editor" });
  if (!isProductAccess(entitled)) return entitled;
  const access = await requireFacebookAccess(req, "editor");
  if (!isFacebookSecurityContext(access)) return access;
  try {
    const { niche, language, apply, about } = (await req.json()) as {
      niche?: string;
      language?: Language;
      apply?: boolean;
      about?: string;
    };
    if (apply) {
      if (!about) return NextResponse.json({ error: "About text is required to apply changes." }, { status: 400 });
      await updatePageInfo(access.settings, { about });
      await entitled.consume();
      return NextResponse.json({ ok: true });
    }
    if (!niche) return NextResponse.json({ error: "A niche is required." }, { status: 400 });
    const info = await fetchPageInfo(access.settings);
    const fix = await generatePageSeoFix(info, niche, language || "en");
    return NextResponse.json({ info, fix });
  } catch (err: unknown) {
    return jsonPublicError(err, "The Page could not be updated.");
  }
}
