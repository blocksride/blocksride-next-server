import { NextResponse } from "next/server";

import { cancelBet } from "@/server/relay/bet";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    intentId: string;
  }>;
};

export async function DELETE(_: Request, { params }: Params) {
  const { intentId } = await params;

  try {
    cancelBet(intentId);
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "intent not found or already submitted";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
