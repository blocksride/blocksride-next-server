import { NextResponse } from "next/server";

import { getActiveRide } from "@/server/supabase/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ride = await getActiveRide();
    return NextResponse.json({ active: Boolean(ride), ride });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch active ride";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
