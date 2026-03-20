import { NextResponse } from "next/server";

import { getPermitInfo } from "@/server/wallet/permit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") ?? "";

  try {
    return NextResponse.json(await getPermitInfo(address));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get permit nonce";
    const status = message.includes("address query parameter") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
