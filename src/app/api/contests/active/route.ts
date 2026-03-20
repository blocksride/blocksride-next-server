import { NextResponse } from "next/server";

import { getActiveRide } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const contest = await getActiveRide();
    return NextResponse.json({ active: Boolean(contest), contest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch active contest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
