import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/admin";
import { listPendingSettlementWindows } from "@/server/settlement/admin";

export const runtime = "nodejs";

const querySchema = z.object({
  poolId: z.string().optional(),
  assetId: z.string().optional(),
  lookbackWindows: z.coerce.number().int().nonnegative().optional()
});

export async function GET(request: Request) {
  try {
    requireAdminSession(request);
    const url = new URL(request.url);
    const query = querySchema.parse({
      poolId: url.searchParams.get("poolId") ?? undefined,
      assetId: url.searchParams.get("assetId") ?? undefined,
      lookbackWindows: url.searchParams.get("lookbackWindows") ?? undefined
    });

    const windows = await listPendingSettlementWindows(query);
    return NextResponse.json({ windows, count: windows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch pending settlement windows";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
