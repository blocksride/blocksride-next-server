import { NextResponse } from "next/server";

import { listTradingPairs } from "@/server/tradingPairs/list";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(listTradingPairs());
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch trading pairs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
