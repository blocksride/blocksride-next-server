import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/request";
import { cancelBet, getBetStatus } from "@/server/relay/bet";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    intentId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    requireSession(request);
    const { intentId } = await params;
    const status = getBetStatus(intentId);
    if (!status) {
      return NextResponse.json({ error: "intent not found" }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to get status";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireSession(request);
    const { intentId } = await params;
    cancelBet(intentId);
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "intent not found or already submitted";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
