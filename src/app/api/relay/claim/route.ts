import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/request";
import { buildClaimIntent, parseSubmitClaimRequest, submitClaim, validateClaimIntent } from "@/server/relay/claim";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = requireSession(request);
    const body = parseSubmitClaimRequest(await request.json());
    const intent = await buildClaimIntent(body);

    if (session.user_id.toLowerCase() !== intent.user.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden: user does not match session user" }, { status: 403 });
    }

    await validateClaimIntent(intent);
    const txHash = await submitClaim(intent);
    return NextResponse.json({ txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to submit claim";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
