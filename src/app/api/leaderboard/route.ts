import { NextResponse } from "next/server";

import { getActiveRide, getRideLeaderboard } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 10;

    const activeRide = await getActiveRide();
    if (!activeRide) {
      return NextResponse.json([]);
    }

    const entries = await getRideLeaderboard(activeRide.contest_id, limit);
    return NextResponse.json(entries);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
