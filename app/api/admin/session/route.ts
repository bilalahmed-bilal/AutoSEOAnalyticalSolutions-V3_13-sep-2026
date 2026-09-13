import { NextRequest, NextResponse } from "next/server";
import { isAdminResult, requirePlatformAdmin } from "@/lib/auth/platform-admin";

export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!isAdminResult(admin)) return admin;
  return NextResponse.json({ admin: true, email: admin.user.email || null });
}
