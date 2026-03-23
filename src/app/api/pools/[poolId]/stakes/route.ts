import { NextResponse } from "next/server";

import { getKeeperPools } from "@/server/config/pools";
import { getStakesSnapshot } from "@/server/chain/stakes";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;
    const pool = getKeeperPools().find(
      (p) => p.poolId.toLowerCase() === poolId.toLowerCase()
    );
    if (!pool) {
      return NextResponse.json({ error: "pool not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const minCellId = parseInt(url.searchParams.get("minCell") ?? "0", 10);
    const maxCellId = parseInt(url.searchParams.get("maxCell") ?? "0", 10);

    if (!minCellId || !maxCellId || maxCellId <= minCellId) {
      return NextResponse.json({ error: "minCell and maxCell query params required" }, { status: 400 });
    }

    const snapshot = await getStakesSnapshot(pool, minCellId, maxCellId);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, max-age=10" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch stakes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
