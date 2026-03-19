import { NextResponse } from "next/server";

import { verifySessionToken } from "@/server/auth/session";
import { markOnboardingComplete } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("auth_token="))
    ?.slice("auth_token=".length);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await markOnboardingComplete(session.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
