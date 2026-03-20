import { NextResponse } from "next/server";

import { getPriceHistory } from "@/server/market-data/history";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const { assetId } = await params;
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  try {
    return NextResponse.json(await getPriceHistory(assetId, start, end));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch price history";
    const status = message.startsWith("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
