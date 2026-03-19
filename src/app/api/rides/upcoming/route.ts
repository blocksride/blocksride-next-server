import { NextResponse } from "next/server";

import { getUpcomingRides } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10;

  try {
    const rides = await getUpcomingRides(limit);
    return NextResponse.json({ rides });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch upcoming rides";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
