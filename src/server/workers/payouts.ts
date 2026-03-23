import { getAddress, type Address } from "viem";

import { getKeeperAccount, getKeeperWalletClient, getPublicClient } from "@/server/chain/client";
import type { PoolKeyConfig } from "@/server/config/pools";
import { env } from "@/server/config/env";
import { getKeeperPools } from "@/server/config/pools";
import { betPlacedEvent, pariHookKeeperAbi, payoutPushedEvent } from "@/shared/abi/pariHookKeeper";
import { getKeeperCursor, setKeeperCursor } from "@/server/supabase/cursors";
import { getWonBetWallets } from "@/server/supabase/bets";

let payoutPushTimer: NodeJS.Timeout | null = null;
let payoutPushInFlight = false;

const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_LOG_BLOCK_RANGE = 9_999n;

export type PayoutPushWorkerStatus =
  | {
      name: "payout-push";
      enabled: true;
      intervalMs: number;
      lookbackWindows: number;
      maxWinnersPerTx: number;
      pools: number;
      account: `0x${string}`;
    }
  | {
      name: "payout-push";
      enabled: false;
      reason: string;
    };

export async function startPayoutPushWorker(intervalMs: number): Promise<PayoutPushWorkerStatus> {
  const pools = getKeeperPools();
  if (!env.PAYOUT_PUSH_WORKER_ENABLED) {
    return { name: "payout-push", enabled: false, reason: "PAYOUT_PUSH_WORKER_ENABLED=false" };
  }
  if (pools.length === 0) {
    return { name: "payout-push", enabled: false, reason: "no keeper pools configured" };
  }

  const account = getKeeperAccount().address;

  if (!payoutPushTimer) {
    void pushReadyPayouts();
    payoutPushTimer = setInterval(() => {
      void pushReadyPayouts();
    }, intervalMs);
  }

  return {
    name: "payout-push",
    enabled: true,
    intervalMs,
    lookbackWindows: env.PAYOUT_PUSH_LOOKBACK_WINDOWS,
    maxWinnersPerTx: env.PAYOUT_PUSH_MAX_WINNERS_PER_TX,
    pools: pools.length,
    account
  };
}

export async function pushReadyPayouts(): Promise<void> {
  if (payoutPushInFlight) {
    return;
  }

  const pools = getKeeperPools();
  if (pools.length === 0) {
    return;
  }

  payoutPushInFlight = true;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const publicClient = getPublicClient();

    for (const pool of pools) {
      if (nowSec < pool.gridEpoch) {
        continue;
      }

      const hookAddress = getAddress(pool.poolKey.hooks);
      let currentWindowId: number;
      try {
        currentWindowId = Number(
          await publicClient.readContract({
            address: hookAddress,
            abi: pariHookKeeperAbi,
            functionName: "currentWindowId",
            args: [pool.poolKey]
          })
        );
      } catch {
        console.warn(`[payouts] pool ${pool.name ?? pool.poolId} grid not configured, skipping`);
        continue;
      }

      const startWindow = Math.max(0, currentWindowId - env.PAYOUT_PUSH_LOOKBACK_WINDOWS);
      const currentBlock = await publicClient.getBlockNumber();
      const cursorKey = `payout:${pool.poolId}`;
      const savedCursor = await getKeeperCursor(cursorKey);
      const lookbackBlocks = BigInt(Math.ceil((env.PAYOUT_PUSH_LOOKBACK_WINDOWS * pool.windowDurationSec) / 2) + 200);
      const deployFromBlock = pool.fromBlock ? BigInt(pool.fromBlock) : currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 0n;
      const fromBlock = savedCursor ?? deployFromBlock;

      for (let windowId = startWindow; windowId <= currentWindowId; windowId += 1) {
        const [, settled, voided, , winningCell] = await publicClient.readContract({
          address: hookAddress,
          abi: pariHookKeeperAbi,
          functionName: "getWindow",
          args: [pool.poolKey, BigInt(windowId)]
        });

        if (!settled || voided || winningCell === MAX_UINT256) {
          continue;
        }

        const scannedTo = await pushPayoutsForWindow({
          poolKey: pool.poolKey,
          poolId: pool.poolId,
          windowId: BigInt(windowId),
          winningCell,
          fromBlock,
          currentBlock,
        });

        if (scannedTo !== null) {
          await setKeeperCursor(cursorKey, scannedTo);
        }
      }
    }
  } catch (error) {
    console.error("[workers] payout push failed", error);
  } finally {
    payoutPushInFlight = false;
  }
}

type PushWindowArgs = {
  poolKey: PoolKeyConfig;
  poolId: `0x${string}`;
  windowId: bigint;
  winningCell: bigint;
  fromBlock: bigint;
  currentBlock: bigint;
};

async function pushPayoutsForWindow({ poolKey, poolId, windowId, winningCell, fromBlock, currentBlock }: PushWindowArgs): Promise<bigint | null> {
  const publicClient = getPublicClient();
  const walletClient = getKeeperWalletClient();
  const account = walletClient.account;
  if (!account) {
    throw new Error("keeper wallet account unavailable");
  }

  const hookAddress = getAddress(poolKey.hooks);

  // ── Step 1: DB winners (fast path) ───────────────────────────────────────
  const dbWallets = await getWonBetWallets(poolId, windowId.toString());
  const dbWinners = new Set<Address>(dbWallets.map(getAddress));

  // ── Step 2: On-chain log scan (source of truth) ───────────────────────────
  const [betLogs, pushedLogs] = await Promise.all([
    getLogsInChunks((chunkFrom, chunkTo) =>
      publicClient.getLogs({
        address: hookAddress,
        event: betPlacedEvent,
        args: { poolId, windowId, cellId: winningCell },
        fromBlock: chunkFrom,
        toBlock: chunkTo
      }), fromBlock, currentBlock),
    getLogsInChunks((chunkFrom, chunkTo) =>
      publicClient.getLogs({
        address: hookAddress,
        event: payoutPushedEvent,
        args: { poolId, windowId },
        fromBlock: chunkFrom,
        toBlock: chunkTo
      }), fromBlock, currentBlock)
  ]);

  const logWinners = new Set<Address>();
  for (const log of betLogs) {
    if (log.args.bettor) logWinners.add(getAddress(log.args.bettor));
  }

  // ── Step 3: Reconcile — union of both sets ────────────────────────────────
  // DB may be missing direct on-chain bets; logs may be missing if relayer was
  // down. Merging both gives the most complete winner list.
  const allWinners = new Set<Address>([...dbWinners, ...logWinners]);

  const onChainGap = [...logWinners].filter((w) => !dbWinners.has(w));
  if (onChainGap.length > 0) {
    console.warn(`[payouts] ${onChainGap.length} winner(s) in logs but not in DB for window ${windowId} — direct on-chain bets?`, onChainGap);
  }

  // ── Step 4: Exclude already-paid ─────────────────────────────────────────
  const alreadyPushed = new Set<Address>();
  for (const log of pushedLogs) {
    if (log.args.winner) alreadyPushed.add(getAddress(log.args.winner));
  }

  const pending = [...allWinners].filter((w) => !alreadyPushed.has(w));
  if (pending.length === 0) {
    return currentBlock;
  }

  // ── Step 5: Push payouts in batches ──────────────────────────────────────
  for (const batch of chunk(pending, env.PAYOUT_PUSH_MAX_WINNERS_PER_TX)) {
    const txHash = await walletClient.writeContract({
      account,
      address: hookAddress,
      abi: pariHookKeeperAbi,
      functionName: "pushPayouts",
      args: [poolKey, windowId, batch]
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[workers] pushed payouts for pool ${poolId} window ${windowId} winners=${batch.length} tx=${txHash}`);
  }

  return currentBlock;
}

async function getLogsInChunks<T>(
  fetchChunk: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint
): Promise<T[]> {
  if (fromBlock > toBlock) {
    return [];
  }

  const logs: T[] = [];
  let chunkFrom = fromBlock;

  while (chunkFrom <= toBlock) {
    const chunkTo = chunkFrom + MAX_LOG_BLOCK_RANGE < toBlock
      ? chunkFrom + MAX_LOG_BLOCK_RANGE
      : toBlock;

    logs.push(...(await fetchChunk(chunkFrom, chunkTo)));
    chunkFrom = chunkTo + 1n;
  }

  return logs;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
