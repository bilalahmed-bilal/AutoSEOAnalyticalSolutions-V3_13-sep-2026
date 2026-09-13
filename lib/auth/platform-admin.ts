import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/supabase";
import { supabaseAdmin } from "@/lib/db/supabase-rest";

export function platformAdminEmails(): string[] {
  return (process.env.NEXORA_PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(email?: string | null, userId?: string | null): Promise<boolean> {
  const normalized = email?.trim().toLowerCase();
  if (normalized && platformAdminEmails().includes(normalized)) return true;
  if (!userId && !normalized) return false;
  try {
    const query = userId
      ? `?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`
      : `?email=eq.${encodeURIComponent(normalized || "")}&select=user_id&limit=1`;
    const rows = await supabaseAdmin<Array<{ user_id: string }>>("platform_admins", {}, query);
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

export async function requirePlatformAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await isPlatformAdmin(user.email, user.id))) {
    return NextResponse.json({ error: "Platform admin permission required." }, { status: 403 });
  }
  return { user };
}

export function isAdminResult(value: unknown): value is { user: { id: string; email?: string | null } } {
  return Boolean(value && typeof value === "object" && "user" in value);
}
