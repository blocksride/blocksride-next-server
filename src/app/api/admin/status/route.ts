import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/auth/admin";
import { getKeeperPools } from "@/server/config/pools";
import { getSeedingStatus } from "@/server/seeding/state";
import { getConfirmedBetRecords, getBetRecordsByWallet } from "@/server/supabase/bets";
import { env } from "@/server/config/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireAdminSession(request);

    const pools = getKeeperPools();
    const seeding = getSeedingStatus();

    // Bet counts from in-memory fallback (works without Supabase table)
    const confirmed = await getConfirmedBetRecords(1000).catch(() => []);
    const allBets = Array.from((globalThis as Record<string, unknown>).__inMemoryBets instanceof Map
      ? ((globalThis as Record<string, unknown>).__inMemoryBets as Map<string, unknown>).values()
      : []);

    const betCounts = allBets.reduce<Record<string, number>>((acc, b) => {
      const state = (b as { state: string }).state;
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      env: {
        network: env.NETWORK,
        rpcUrl: env.RPC_URL,
        contractAddress: env.PARIHOOK_CONTRACT_ADDRESS,
        supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        workersEnabled: env.ENABLE_INTERNAL_WORKERS,
        settlementEnabled: env.SETTLEMENT_WORKER_ENABLED,
        betSettlementEnabled: env.BET_SETTLEMENT_WORKER_ENABLED,
      },
      pools: pools.map(p => ({
        name: p.name ?? p.assetId,
        assetId: p.assetId,
        poolId: p.poolId,
        windowDurationSec: p.windowDurationSec,
        gridEpoch: p.gridEpoch,
        hasPriceFeed: Boolean(p.priceFeedId),
      })),
      seeding,
      bets: {
        counts: betCounts,
        total: allBets.length,
        recentConfirmed: confirmed.slice(0, 20),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
