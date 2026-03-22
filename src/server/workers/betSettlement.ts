/**
 * Bet settlement worker: polls confirmed bet_records, checks on-chain window state,
 * and updates each bet to won/lost/voided once the window is settled.
 */
import { getAddress, isAddress } from "viem";

import { getKeeperPools, type PoolKeyConfig } from "@/server/config/pools";
import { getPublicClient } from "@/server/chain/client";
import { pariHookKeeperAbi } from "@/shared/abi/pariHookKeeper";
import { getConfirmedBetRecords, updateWindowBetOutcomes, type BetRecord } from "@/server/supabase/bets";

let betSettlementTimer: NodeJS.Timeout | null = null;
let betSettlementInFlight = false;

export type BetSettlementWorkerStatus =
  | { name: "bet-settlement"; enabled: true; intervalMs: number }
  | { name: "bet-settlement"; enabled: false; reason: string };

export async function startBetSettlementWorker(intervalMs: number): Promise<BetSettlementWorkerStatus> {
  if (!betSettlementTimer) {
    void settleBetRecords();
    betSettlementTimer = setInterval(() => {
      void settleBetRecords();
    }, intervalMs);
  }

  return { name: "bet-settlement", enabled: true, intervalMs };
}

async function settleBetRecords(): Promise<void> {
  if (betSettlementInFlight) return;

  betSettlementInFlight = true;
  try {
    const confirmed = await getConfirmedBetRecords();
    if (confirmed.length === 0) return;

    const pools = getKeeperPools();
    const publicClient = getPublicClient();

    // Group bets by poolId + windowId to minimize RPC calls
    const groups = new Map<string, { poolId: string; windowId: string; records: BetRecord[]; pool?: PoolKeyConfig }>();

    for (const record of confirmed) {
      const key = `${record.pool_id}:${record.window_id}`;
      if (!groups.has(key)) {
        const pool = pools.find((p) => p.poolId.toLowerCase() === record.pool_id.toLowerCase());
        groups.set(key, { poolId: record.pool_id, windowId: record.window_id, records: [], pool });
      }
      groups.get(key)!.records.push(record);
    }

    const nowSec = Math.floor(Date.now() / 1000);

    for (const { poolId, windowId, records, pool } of groups.values()) {
      if (!pool || !isAddress(pool.poolKey.hooks)) {
        continue;
      }

      // Only check windows that have closed
      const windowIdNum = Number(windowId);
      const windowEndSec = pool.gridEpoch + (windowIdNum + 1) * pool.windowDurationSec;
      if (nowSec < windowEndSec) {
        continue; // window still open
      }

      try {
        const hookAddress = getAddress(pool.poolKey.hooks);
        const [, settled, voided, , winningCell, redemptionRate] = await publicClient.readContract({
          address: hookAddress,
          abi: pariHookKeeperAbi,
          functionName: "getWindow",
          args: [pool.poolKey, BigInt(windowId)]
        });

        if (!settled && !voided) {
          continue; // not settled yet
        }

        const winningCellStr = voided ? null : winningCell.toString();
        await updateWindowBetOutcomes(poolId, windowId, winningCellStr, redemptionRate, voided);
        console.log(`[bet-settlement] settled window ${windowId} pool ${pool.name ?? pool.poolId} winning_cell=${winningCellStr} voided=${voided} (${records.length} bets)`);
      } catch (error) {
        console.error(`[bet-settlement] failed for pool ${pool.name ?? pool.poolId} window ${windowId}`, error);
      }
    }
  } finally {
    betSettlementInFlight = false;
  }
}
