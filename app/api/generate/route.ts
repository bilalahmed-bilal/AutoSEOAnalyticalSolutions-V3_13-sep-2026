import { requireApiAccess, unauthorizedResponse } from "@/lib/auth/api-access";
import { NextRequest, NextResponse } from "next/server";
import { generateContent, GenerateContentInput } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const access = await requireApiAccess(req);
  if (!access) return unauthorizedResponse();
  try {
    const input = (await req.json()) as GenerateContentInput;

    if (!input.channel || !input.language || !input.topic || !input.profile) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const content = await generateContent(input);
    return NextResponse.json({ content });
  } catch (err) {
    console.error("generate-content error:", err);
    return NextResponse.json(
      { error: "Content generation failed. Please try again." },
      { status: 500 }
    );
  }
}
