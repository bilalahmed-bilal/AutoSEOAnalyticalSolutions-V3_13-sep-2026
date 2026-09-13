import { NextRequest, NextResponse } from "next/server";
import { generateContent, GenerateContentInput } from "@/lib/claude";
import { isProductAccess, requireProductAccess } from "@/lib/billing/access";

export async function POST(req: NextRequest) {
  const entitled = await requireProductAccess(req, {
    feature: "content.generate",
    minRole: "editor",
    usageMetric: "ai.generations",
  });
  if (!isProductAccess(entitled)) return entitled;
  try {
    const input = (await req.json()) as GenerateContentInput;

    if (!input.channel || !input.language || !input.topic || !input.profile) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const content = await generateContent(input);
    await entitled.consume();
    return NextResponse.json({ content });
  } catch (err) {
    console.error("generate-content error:", err);
    return NextResponse.json({ error: "Content generation failed. Please try again." }, { status: 500 });
  }
}
