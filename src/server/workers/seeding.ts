import { getAddress, maxUint256 } from "viem";

import { getKeeperWalletClient, getPublicClient } from "@/server/chain/client";
import { env } from "@/server/config/env";
import { getKeeperPools } from "@/server/config/pools";
import { getPublicPrice, isSupportedPublicPriceAsset } from "@/server/market-data/publicPrice";
import { getNextSeedTask, markSeededKey, markWindowSeeded, wasWindowSeeded } from "@/server/seeding/state";
import { pariHookKeeperAbi } from "@/shared/abi/pariHookKeeper";
import { usdcAbi } from "@/shared/abi/usdc";

let seedingTimer: NodeJS.Timeout | null = null;
let seedingInFlight = false;

export type SeedingWorkerStatus =
  | {
      name: "seeding";
      enabled: true;
      intervalMs: number;
      defaultRange: number;
      seedAmountUsdc: string;
    }
  | {
      name: "seeding";
      enabled: false;
      reason: string;
    };

const SEED_AMOUNT_USDC = BigInt(env.SEED_AMOUNT_USDC);

export async function startSeedingWorker(intervalMs: number): Promise<SeedingWorkerStatus> {
  if (!env.SEEDING_WORKER_ENABLED) {
    return { name: "seeding", enabled: false, reason: "SEEDING_WORKER_ENABLED=false" };
  }

  if (!seedingTimer) {
    void seedArmedWindows();
    seedingTimer = setInterval(() => {
      void seedArmedWindows();
    }, intervalMs);
  }

  return {
    name: "seeding",
    enabled: true,
    intervalMs,
    defaultRange: env.SEEDING_DEFAULT_RANGE,
    seedAmountUsdc: SEED_AMOUNT_USDC.toString()
  };
}

export async function seedArmedWindows(): Promise<void> {
  if (seedingInFlight) {
    return;
  }

  const task = getNextSeedTask();
  if (!task || task.pending.length === 0) {
    return;
  }

  seedingInFlight = true;
  try {
    const windowId = task.pending[0];
    if (windowId === undefined) {
      return;
    }

    const pool = (task.poolId
      ? getKeeperPools().find((item) => item.poolId.toLowerCase() === task.poolId?.toLowerCase())
      : task.assetId
        ? getKeeperPools().find((item) => item.assetId === task.assetId)
        : getKeeperPools()[0]) ?? null;

    if (!pool) {
      throw new Error("no pool available for seeding");
    }

    const seededKey = `${pool.poolId}:${windowId}`;
    if (wasWindowSeeded(seededKey)) {
      markWindowSeeded(windowId);
      return;
    }

    const hookAddress = getAddress(pool.poolKey.hooks);
    const publicClient = getPublicClient();
    const walletClient = getKeeperWalletClient();
    const account = walletClient.account;
    if (!account) {
      throw new Error("keeper wallet account unavailable");
    }

    const [config, priceResult] = await Promise.all([
      publicClient.readContract({
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "gridConfigs",
        args: [pool.poolId]
      }),
      fetchPrice(pool.assetId)
    ]);

    const bandWidth = config[1];
    if (bandWidth <= 0n) {
      throw new Error("bandWidth is not configured on-chain");
    }

    const range = task.range > 0 ? task.range : env.SEEDING_DEFAULT_RANGE;
    const centreCell = BigInt(Math.floor(priceResult * 1_000_000)) / bandWidth;
    const startCell = centreCell - BigInt(range);
    const endCell = centreCell + BigInt(range);
    const totalCells = range * 2 + 1;
    const requiredAllowance = BigInt(totalCells) * SEED_AMOUNT_USDC;

    const allowance = await publicClient.readContract({
      address: getAddress(config[7]),
      abi: usdcAbi,
      functionName: "allowance",
      args: [account.address, hookAddress]
    });

    if (allowance < requiredAllowance) {
      const approvalHash = await walletClient.writeContract({
        account,
        address: getAddress(config[7]),
        abi: usdcAbi,
        functionName: "approve",
        args: [hookAddress, maxUint256]
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });
    }

    for (let cell = startCell; cell <= endCell; cell++) {
      const hash = await walletClient.writeContract({
        account,
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "seedWindow",
        args: [pool.poolKey, cell, BigInt(windowId), SEED_AMOUNT_USDC]
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }

    markSeededKey(seededKey);
    markWindowSeeded(windowId);
    console.log(`[workers] seeded window ${windowId} for pool ${pool.name ?? pool.poolId}`);
  } catch (error) {
    console.error("[workers] seeding failed", error);
  } finally {
    seedingInFlight = false;
  }
}

async function fetchPrice(assetId: string): Promise<number> {
  if (!isSupportedPublicPriceAsset(assetId)) {
    throw new Error(`unsupported seeding asset: ${assetId}`);
  }
  const { price } = await getPublicPrice(assetId);
  return price;
}
