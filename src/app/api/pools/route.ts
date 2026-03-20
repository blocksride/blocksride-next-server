import { NextResponse } from "next/server";

import { getKeeperPools } from "@/server/config/pools";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(getKeeperPools());
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch pools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
