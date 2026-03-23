import { NextResponse } from "next/server";
import { getRelayerAccount } from "@/server/chain/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { address } = getRelayerAccount();
    return NextResponse.json({ address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
