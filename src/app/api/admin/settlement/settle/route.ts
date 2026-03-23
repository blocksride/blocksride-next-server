import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/admin";
import { settleWindowAsAdmin } from "@/server/settlement/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  windowId: z.number().int().nonnegative(),
  poolId: z.string().optional(),
  assetId: z.string().optional()
}).refine((value) => Boolean(value.poolId || value.assetId), {
  message: "poolId or assetId is required"
});

export async function POST(request: Request) {
  try {
    requireAdminSession(request);
    const body = bodySchema.parse(await request.json());
    const result = await settleWindowAsAdmin(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to settle window";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
