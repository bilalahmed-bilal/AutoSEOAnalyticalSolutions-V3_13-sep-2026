import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { processPublishBatch } from "@/lib/jobs/process-publish";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Cron authentication failed." }, { status: 401 });

  let recovered = 0;
  try {
    recovered = Number(await supabaseAdmin<number>("rpc/recover_stale_jobs", { method: "POST", body: JSON.stringify({ p_stale_after: "10 minutes" }) }));
  } catch (e) {
    console.error("stale job recovery failed", e);
  }
  const results = await processPublishBatch(5);
  return NextResponse.json({ ok: true, recovered, processed: results.filter((r) => r.claimed).length, results });
}
