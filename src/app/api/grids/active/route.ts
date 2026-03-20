import { NextResponse } from "next/server";

import { getActiveSyntheticGrids } from "@/server/grid/synthetic";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("asset_id") ?? undefined;
  const rawTimeframe = searchParams.get("timeframe");
  const timeframe = rawTimeframe ? Number(rawTimeframe) : undefined;

  try {
    return NextResponse.json(getActiveSyntheticGrids(assetId, Number.isFinite(timeframe) ? timeframe : undefined));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch active grids";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
