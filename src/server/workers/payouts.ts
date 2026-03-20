import { getAddress, type Address } from "viem";

import { getKeeperAccount, getKeeperWalletClient, getPublicClient } from "@/server/chain/client";
import type { PoolKeyConfig } from "@/server/config/pools";
import { env } from "@/server/config/env";
import { getKeeperPools } from "@/server/config/pools";
import { betPlacedEvent, pariHookKeeperAbi, payoutPushedEvent } from "@/shared/abi/pariHookKeeper";

let payoutPushTimer: NodeJS.Timeout | null = null;
let payoutPushInFlight = false;

const MAX_UINT256 = (1n << 256n) - 1n;

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
      const currentWindowId = Number(
        await publicClient.readContract({
          address: hookAddress,
          abi: pariHookKeeperAbi,
          functionName: "currentWindowId",
          args: [pool.poolKey]
        })
      );

      const startWindow = Math.max(0, currentWindowId - env.PAYOUT_PUSH_LOOKBACK_WINDOWS);
      const currentBlock = await publicClient.getBlockNumber();
      const lookbackBlocks = BigInt(Math.ceil((env.PAYOUT_PUSH_LOOKBACK_WINDOWS * pool.windowDurationSec) / 2) + 200);
      const fromBlock = pool.fromBlock
        ? BigInt(pool.fromBlock)
        : currentBlock > lookbackBlocks
          ? currentBlock - lookbackBlocks
          : 0n;

      for (let windowId = startWindow; windowId <= currentWindowId; windowId += 1) {
        const [, settled, voided, winningCell] = await publicClient.readContract({
          address: hookAddress,
          abi: pariHookKeeperAbi,
          functionName: "getWindow",
          args: [pool.poolKey, BigInt(windowId)]
        });

        if (!settled || voided || winningCell === MAX_UINT256) {
          continue;
        }

        await pushPayoutsForWindow({
          poolKey: pool.poolKey,
          poolId: pool.poolId,
          windowId: BigInt(windowId),
          winningCell,
          fromBlock
        });
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
};

async function pushPayoutsForWindow({ poolKey, poolId, windowId, winningCell, fromBlock }: PushWindowArgs): Promise<void> {
  const publicClient = getPublicClient();
  const walletClient = getKeeperWalletClient();
  const account = walletClient.account;
  if (!account) {
    throw new Error("keeper wallet account unavailable");
  }

  const hookAddress = getAddress(poolKey.hooks);
  const [betLogs, pushedLogs] = await Promise.all([
    publicClient.getLogs({
      address: hookAddress,
      event: betPlacedEvent,
      args: { poolId, windowId, cellId: winningCell },
      fromBlock,
      toBlock: "latest"
    }),
    publicClient.getLogs({
      address: hookAddress,
      event: payoutPushedEvent,
      args: { poolId, windowId },
      fromBlock,
      toBlock: "latest"
    })
  ]);

  const winners = new Set<Address>();
  for (const log of betLogs) {
    const bettor = log.args.bettor;
    if (bettor) {
      winners.add(getAddress(bettor));
    }
  }

  const alreadyPushed = new Set<Address>();
  for (const log of pushedLogs) {
    const winner = log.args.winner;
    if (winner) {
      alreadyPushed.add(getAddress(winner));
    }
  }

  const pending = [...winners].filter((winner) => !alreadyPushed.has(winner));
  if (pending.length === 0) {
    return;
  }

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
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
