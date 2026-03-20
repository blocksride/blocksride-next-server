import { NextResponse } from "next/server";

import { ensureSyntheticGrid } from "@/server/grid/synthetic";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("asset_id") ?? "ETH-USD";
  const timeframe = Number(searchParams.get("timeframe") ?? "60");

  try {
    const grid = ensureSyntheticGrid(assetId, timeframe);
    if (!grid) {
      return NextResponse.json({ error: "grid not configured" }, { status: 404 });
    }
    return NextResponse.json(grid);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to ensure grid";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
