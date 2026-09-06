import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { generateTrendIdeas } from "@/lib/claude";
import type { Language } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  try {
    const { niche, language } = (await req.json()) as { niche?: string; language?: Language };
    if (!niche || !niche.trim()) {
      return NextResponse.json({ error: "Niche batana zaroori hai." }, { status: 400 });
    }
    const ideas = await generateTrendIdeas(niche.trim(), language || "ur");
    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("trends error:", err);
    return NextResponse.json(
      { error: "Trend ideas generate nahi ho sakin. Dobara koshish karein." },
      { status: 500 }
    );
  }
}
