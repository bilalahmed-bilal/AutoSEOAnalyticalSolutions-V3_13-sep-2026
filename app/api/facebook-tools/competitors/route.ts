import { NextRequest, NextResponse } from "next/server";
import { getPublishSettings, listCompetitorChannels, addCompetitorChannel, removeCompetitorChannel } from "@/lib/store";
import { fetchPublicPageStats } from "@/lib/publishers/facebook";
import { errorMessage } from "@/lib/unknown";

export async function GET() {
  try {
    const settings = getPublishSettings();
    if (!settings.facebook) {
      return NextResponse.json({ error: "Pehle Publish tab mein Facebook connect karein." }, { status: 400 });
    }
    const tracked = listCompetitorChannels("facebook");
    const results = await Promise.all(
      tracked.map(async (c) => {
        try {
          const stats = await fetchPublicPageStats(settings.facebook!.settings, c.channelIdOrHandle);
          return { id: c.id, ...stats };
        } catch (err: unknown) {
          return { id: c.id, pageId: c.channelIdOrHandle, error: errorMessage(err) };
        }
      })
    );
    return NextResponse.json({ pages: results });
  } catch (err) {
    console.error("fb competitor list error:", err);
    return NextResponse.json({ error: "Competitor data load nahi ho saka." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { pageIdOrUsername } = (await req.json()) as { pageIdOrUsername?: string };
    if (!pageIdOrUsername || !pageIdOrUsername.trim()) {
      return NextResponse.json({ error: "Page ID ya username batana zaroori hai." }, { status: 400 });
    }
    const entry = addCompetitorChannel("facebook", pageIdOrUsername.trim());
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("fb competitor add error:", err);
    return NextResponse.json({ error: "Add nahi ho saka." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "ID zaroori hai." }, { status: 400 });
    removeCompetitorChannel(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("fb competitor remove error:", err);
    return NextResponse.json({ error: "Remove nahi ho saka." }, { status: 500 });
  }
}
