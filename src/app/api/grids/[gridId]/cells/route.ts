import { NextResponse } from "next/server";

import { getSyntheticCells } from "@/server/grid/synthetic";
import { getPublicPrice, isSupportedPublicPriceAsset } from "@/server/market-data/publicPrice";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    gridId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const { gridId } = await params;
  const { searchParams } = new URL(request.url);

  // Client can pass ?anchor_price=3801.5 to avoid an extra fetch
  let anchorPrice = Number(searchParams.get("anchor_price") ?? 0);

  if (!anchorPrice) {
    // Derive assetId from gridId (format: "{assetId}-live")
    const assetId = gridId.replace(/-live$/, "");
    if (isSupportedPublicPriceAsset(assetId)) {
      try {
        const result = await getPublicPrice(assetId);
        anchorPrice = result.price;
      } catch {
        // fall through — getSyntheticCells returns [] when anchorPrice is 0
      }
    }
  }

  return NextResponse.json(getSyntheticCells(gridId, anchorPrice));
}
