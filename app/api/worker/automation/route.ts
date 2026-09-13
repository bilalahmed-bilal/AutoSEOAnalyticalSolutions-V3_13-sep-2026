import { NextRequest, NextResponse } from "next/server";
import { processAutomationRunBatch } from "@/lib/automation-worker";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Worker authentication failed." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === "number" ? body.limit : 5;
  try {
    return NextResponse.json({ ok: true, ...(await processAutomationRunBatch(limit)) });
  } catch (error) {
    console.error("automation worker failed", error);
    return NextResponse.json({ ok: false, error: "Automation worker failed." }, { status: 500 });
  }
}
