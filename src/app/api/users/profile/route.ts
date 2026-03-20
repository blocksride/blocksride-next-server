import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/request";
import { getUserProfile, upsertUserProfile } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = requireSession(request);
    const body = (await request.json().catch(() => ({}))) as { nickname?: string };

    if (typeof body.nickname !== "string") {
      return NextResponse.json({ error: "nickname is required" }, { status: 400 });
    }

    const existing = await getUserProfile(session.user_id);
    const walletAddress = existing?.wallet_address || session.user_id;
    const email = existing?.email ?? "";
    const onboardingCompleted = existing?.onboarding_completed ?? false;

    await upsertUserProfile({
      user_id: session.user_id,
      email,
      wallet_address: walletAddress,
      nickname: body.nickname,
      onboarding_completed: onboardingCompleted
    });

    return NextResponse.json({
      user: {
        id: session.user_id,
        email,
        nickname: body.nickname,
        wallet_address: walletAddress,
        balance: 0
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
