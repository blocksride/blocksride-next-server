import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/auth/admin";
import { disarmSeeding } from "@/server/seeding/state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireAdminSession(request);
    disarmSeeding();
    return NextResponse.json({ disarmed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to disarm seeding";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
