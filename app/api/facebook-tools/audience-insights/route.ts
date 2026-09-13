import { NextResponse } from "next/server";
import { getPublishSettings } from "@/lib/store";
import { fetchAudienceInsights } from "@/lib/publishers/facebook";
import { errorMessage } from "@/lib/unknown";

export async function GET() {
  try {
    const settings = getPublishSettings();
    if (!settings.facebook) {
      return NextResponse.json({ error: "Pehle Publish tab mein Facebook connect karein." }, { status: 400 });
    }
    const insights = await fetchAudienceInsights(settings.facebook.settings);
    return NextResponse.json({ insights });
  } catch (err: unknown) {
    console.error("fb audience insights error:", err);
    return NextResponse.json({ error: errorMessage(err, "Insights fetch nahi ho sakay.") }, { status: 500 });
  }
}
