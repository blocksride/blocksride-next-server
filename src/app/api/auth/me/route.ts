import { NextResponse } from "next/server";

import type { SessionUser } from "@/shared/auth";
import { verifySessionToken } from "@/server/auth/session";
import { getUserProfile } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    const profile = await getUserProfile(session.user_id);
    const user: SessionUser = {
      id: session.user_id,
      email: profile?.email ?? "",
      nickname: profile?.nickname ?? "",
      wallet_address: profile?.wallet_address ?? session.user_id,
      balance: 0,
      practice_balance: 0,
      has_seen_betting_onboarding: profile?.onboarding_completed ?? false
    };
    return NextResponse.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
