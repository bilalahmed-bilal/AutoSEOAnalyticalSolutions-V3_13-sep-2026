import { NextRequest, NextResponse } from "next/server";
import { getPublishSettings } from "@/lib/store";
import { fetchPageInfo, updatePageInfo } from "@/lib/publishers/facebook";
import { generatePageSeoFix } from "@/lib/claude";
import type { Language } from "@/lib/claude";
import { errorMessage } from "@/lib/unknown";

export async function GET() {
  try {
    const settings = getPublishSettings();
    if (!settings.facebook) {
      return NextResponse.json({ error: "Pehle Publish tab mein Facebook connect karein." }, { status: 400 });
    }
    const info = await fetchPageInfo(settings.facebook.settings);
    return NextResponse.json({ info });
  } catch (err: unknown) {
    console.error("fb page-info error:", err);
    return NextResponse.json({ error: errorMessage(err, "Page info fetch nahi ho saka.") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { niche, language, apply, about } = (await req.json()) as {
      niche?: string;
      language?: Language;
      apply?: boolean;
      about?: string;
    };

    const settings = getPublishSettings();
    if (!settings.facebook) {
      return NextResponse.json({ error: "Pehle Publish tab mein Facebook connect karein." }, { status: 400 });
    }

    if (apply) {
      if (!about) return NextResponse.json({ error: "About text zaroori hai apply karne ke liye." }, { status: 400 });
      await updatePageInfo(settings.facebook.settings, { about });
      return NextResponse.json({ ok: true });
    }

    if (!niche) return NextResponse.json({ error: "Niche batana zaroori hai." }, { status: 400 });
    const info = await fetchPageInfo(settings.facebook.settings);
    const fix = await generatePageSeoFix(info, niche, language || "ur");
    return NextResponse.json({ info, fix });
  } catch (err: unknown) {
    console.error("fb page-info error:", err);
    return NextResponse.json({ error: errorMessage(err, "Kuch ghalat ho gaya.") }, { status: 500 });
  }
}
