import { NextResponse } from "next/server";

import { getRideLeaderboard } from "@/server/supabase/client";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    rideId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const { rideId } = await params;
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;

  try {
    const entries = await getRideLeaderboard(rideId, limit);
    return NextResponse.json({ ride_id: rideId, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch ride leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
