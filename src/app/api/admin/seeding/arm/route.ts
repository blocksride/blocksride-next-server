import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/admin";
import { armSeeding } from "@/server/seeding/state";
import { env } from "@/server/config/env";

export const runtime = "nodejs";

const armSchema = z.object({
  windowIds: z.array(z.number().int().nonnegative()).min(1),
  range: z.number().int().positive().optional(),
  poolId: z.string().optional(),
  assetId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    requireAdminSession(request);
    const body = armSchema.parse(await request.json());
    const config = armSeeding({
      pending: body.windowIds,
      range: body.range ?? env.SEEDING_DEFAULT_RANGE,
      ...(body.poolId ? { poolId: body.poolId as `0x${string}` } : {}),
      ...(body.assetId ? { assetId: body.assetId } : {})
    });

    return NextResponse.json({
      armed: true,
      pending: config.pending,
      range: config.range,
      ...(config.poolId ? { poolId: config.poolId } : {}),
      ...(config.assetId ? { assetId: config.assetId } : {})
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to arm seeding";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
