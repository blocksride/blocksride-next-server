import { NextResponse } from "next/server";

import { getBetNonce } from "@/server/relay/nonces";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address query parameter is required" }, { status: 400 });
  }

  try {
    const nonce = await getBetNonce(address);
    return NextResponse.json({ nonce: nonce.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to get nonce";
    const status = message === "invalid address" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
