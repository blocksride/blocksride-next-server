import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/auth/admin";
import { getSeedingStatus } from "@/server/seeding/state";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireAdminSession(request);
    return NextResponse.json(getSeedingStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch seeding status";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
