import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/request";
import { buildBetIntent, parsePlaceBetRequest, scheduleBet, validateBetIntent } from "@/server/relay/bet";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = requireSession(request);
    const body = parsePlaceBetRequest(await request.json());
    const intent = buildBetIntent(body);

    if (session.user_id.toLowerCase() !== intent.signer.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden: signer does not match session user" }, { status: 403 });
    }

    await validateBetIntent(intent);
    const scheduled = await scheduleBet(intent, body.submitAfterMs ?? 3000);
    return NextResponse.json(scheduled);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to schedule bet";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
