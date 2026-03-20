import { NextResponse } from "next/server";

import { getBetRecordsByWallet } from "@/server/supabase/bets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "wallet address required" }, { status: 400 });
  }

  try {
    const bets = await getBetRecordsByWallet(wallet);
    return NextResponse.json(bets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch bets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
