import { NextResponse } from "next/server";

import { getRideLeaderboard } from "@/server/supabase/client";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    contestId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const { contestId } = await params;
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;

  try {
    const entries = await getRideLeaderboard(contestId, limit);
    return NextResponse.json({ contest_id: contestId, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch contest leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
