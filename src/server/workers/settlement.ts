import { getAddress, isAddress, type Hex } from "viem";

import { getKeeperPools } from "@/server/config/pools";
import { env } from "@/server/config/env";
import { getKeeperAccount, getKeeperWalletClient, getPublicClient } from "@/server/chain/client";
import { pariHookKeeperAbi, pythFeeAbi } from "@/shared/abi/pariHookKeeper";

let settlementTimer: NodeJS.Timeout | null = null;
let settlementInFlight = false;

export type SettlementWorkerStatus =
  | {
      name: "settlement";
      enabled: true;
      intervalMs: number;
      lookbackWindows: number;
      maxWindowsPerTick: number;
      pools: number;
      account: `0x${string}`;
    }
  | {
      name: "settlement";
      enabled: false;
      reason: string;
    };

export async function startSettlementWorker(intervalMs: number): Promise<SettlementWorkerStatus> {
  const pools = getKeeperPools().filter((pool) => Boolean(pool.priceFeedId));
  if (!env.SETTLEMENT_WORKER_ENABLED) {
    return { name: "settlement", enabled: false, reason: "SETTLEMENT_WORKER_ENABLED=false" };
  }
  if (pools.length === 0) {
    return { name: "settlement", enabled: false, reason: "no keeper pools with priceFeedId configured" };
  }
  if (!env.PYTH_CONTRACT_ADDRESS || !isAddress(env.PYTH_CONTRACT_ADDRESS)) {
    return { name: "settlement", enabled: false, reason: "PYTH_CONTRACT_ADDRESS is missing or invalid" };
  }

  const account = getKeeperAccount().address;

  if (!settlementTimer) {
    await settleReadyWindows();
    settlementTimer = setInterval(() => {
      void settleReadyWindows();
    }, intervalMs);
  }

  return {
    name: "settlement",
    enabled: true,
    intervalMs,
    lookbackWindows: env.SETTLEMENT_LOOKBACK_WINDOWS,
    maxWindowsPerTick: env.SETTLEMENT_MAX_WINDOWS_PER_TICK,
    pools: pools.length,
    account
  };
}

export async function settleReadyWindows(): Promise<void> {
  if (settlementInFlight) {
    return;
  }

  const pools = getKeeperPools().filter((pool) => Boolean(pool.priceFeedId));
  if (pools.length === 0) {
    return;
  }

  settlementInFlight = true;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const publicClient = getPublicClient();
    const walletClient = getKeeperWalletClient();
    const keeperAccount = getKeeperAccount();
    const pythAddress = getAddress(env.PYTH_CONTRACT_ADDRESS as `0x${string}`);

    for (const pool of pools) {
      if (nowSec < pool.gridEpoch || !pool.priceFeedId) {
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

      const startWindow = Math.max(0, currentWindowId - env.SETTLEMENT_LOOKBACK_WINDOWS);
      let settledCount = 0;

      for (let windowId = startWindow; windowId <= currentWindowId; windowId++) {
        if (settledCount >= env.SETTLEMENT_MAX_WINDOWS_PER_TICK) {
          break;
        }

        const windowEnd = pool.gridEpoch + (windowId + 1) * pool.windowDurationSec;
        if (nowSec < windowEnd) {
          continue;
        }

        const [totalPool, settled, voided] = await publicClient.readContract({
          address: hookAddress,
          abi: pariHookKeeperAbi,
          functionName: "getWindow",
          args: [pool.poolKey, BigInt(windowId)]
        });

        if (settled || voided || totalPool === 0n) {
          continue;
        }

        try {
          const vaa = await fetchPythVaa(pool.priceFeedId, windowEnd);
          const updateFee = await publicClient.readContract({
            address: pythAddress,
            abi: pythFeeAbi,
            functionName: "getUpdateFee",
            args: [[vaa]]
          });

          const txHash = await walletClient.writeContract({
            account: keeperAccount,
            address: hookAddress,
            abi: pariHookKeeperAbi,
            functionName: "settle",
            args: [pool.poolKey, BigInt(windowId), vaa],
            value: updateFee
          });

          settledCount += 1;
          console.log(`[workers] settled pool ${pool.name ?? pool.poolId} window ${windowId} tx=${txHash}`);
        } catch (error) {
          console.error(`[workers] settlement failed for pool ${pool.name ?? pool.poolId} window ${windowId}`, error);
        }
      }
    }
  } finally {
    settlementInFlight = false;
  }
}

export async function fetchPythVaa(feedId: string, timestamp: number): Promise<Hex> {
  const url = new URL(`${env.PYTH_HERMES_URL}/v2/updates/price/${timestamp}`);
  url.searchParams.append("ids[]", feedId);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Pyth Hermes request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { binary?: { data?: string[] } };
  const vaaHex = payload.binary?.data?.[0];
  if (!vaaHex) {
    throw new Error("No VAA returned from Pyth Hermes");
  }

  return `0x${vaaHex}` as Hex;
}
