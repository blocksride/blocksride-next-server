import { NextResponse } from "next/server";

import { getPublicPrice, isSupportedPublicPriceAsset } from "@/server/market-data/publicPrice";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("asset_id") ?? "ETH-USD";

  if (!isSupportedPublicPriceAsset(assetId)) {
    return NextResponse.json({ error: "unsupported asset_id" }, { status: 400 });
  }

  try {
    const price = await getPublicPrice(assetId);
    return NextResponse.json(price);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch public price";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
