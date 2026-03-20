import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/request";
import { getUserStatsSummary } from "@/server/stats/user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = requireSession(request);
    return NextResponse.json(getUserStatsSummary(session.user_id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch user stats";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
