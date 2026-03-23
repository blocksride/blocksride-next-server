import { getAddress, type Hex } from "viem";

import { getPublicClient, getKeeperAccount, getKeeperWalletClient } from "@/server/chain/client";
import { getKeeperPoolByPoolId, getKeeperPools, type KeeperPoolConfig } from "@/server/config/pools";
import { env } from "@/server/config/env";
import { pariHookKeeperAbi, pythFeeAbi } from "@/shared/abi/pariHookKeeper";
import { fetchPythVaa } from "@/server/settlement/pyth";

type SettlementWindowBase = {
  poolId: `0x${string}`;
  assetId: string;
  name?: string;
  windowId: number;
  windowStart: number;
  resolutionDeadline: number;
  totalPool: string;
  unresolved: boolean;
  canSettleNow: boolean;
  canFinalizeUnresolved: boolean;
  hookAddress: `0x${string}`;
};

export type PendingSettlementWindow = SettlementWindowBase & {
  unsettledStatus: "ready_to_settle" | "finalizable_unresolved";
};

export type AwaitingCloseWindow = SettlementWindowBase & {
  unsettledStatus: "awaiting_close";
};

export async function listPendingSettlementWindows(input?: {
  poolId?: string;
  assetId?: string;
  lookbackWindows?: number;
}): Promise<PendingSettlementWindow[]> {
  const { pending } = await scanSettlementWindows(input);
  return pending;
}

export async function listAwaitingCloseWindows(input?: {
  poolId?: string;
  assetId?: string;
  lookbackWindows?: number;
}): Promise<AwaitingCloseWindow[]> {
  const { awaitingClose } = await scanSettlementWindows(input);
  return awaitingClose;
}

async function scanSettlementWindows(input?: {
  poolId?: string;
  assetId?: string;
  lookbackWindows?: number;
}): Promise<{
  pending: PendingSettlementWindow[];
  awaitingClose: AwaitingCloseWindow[];
}> {
  const pools = filterPools(input);
  if (pools.length === 0) {
    return { pending: [], awaitingClose: [] };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const publicClient = getPublicClient();
  const lookbackWindows = Math.max(0, input?.lookbackWindows ?? env.SETTLEMENT_LOOKBACK_WINDOWS);
  const pending: PendingSettlementWindow[] = [];
  const awaitingClose: AwaitingCloseWindow[] = [];

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
      continue;
    }

    const startWindow = Math.max(0, currentWindowId - lookbackWindows);
    const candidateWindowIds = new Set<number>();
    for (let windowId = startWindow; windowId <= currentWindowId; windowId += 1) {
      candidateWindowIds.add(windowId);
    }

    try {
      const unresolvedWindows = await publicClient.readContract({
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "getUnresolvedWindows",
        args: [pool.poolKey]
      });
      for (const windowId of unresolvedWindows) {
        candidateWindowIds.add(Number(windowId));
      }
    } catch {
      // Ignore unresolved lookup failures and fall back to range scanning.
    }

    for (const windowId of Array.from(candidateWindowIds).sort((a, b) => a - b)) {
      const [totalPool, settled, voided, unresolved] = await publicClient.readContract({
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "getWindow",
        args: [pool.poolKey, BigInt(windowId)]
      });

      if (settled || voided) {
        continue;
      }

      if (totalPool === 0n && !unresolved) {
        continue;
      }

      const windowStart = pool.gridEpoch + windowId * pool.windowDurationSec;
      const resolutionDeadline = windowStart + pool.windowDurationSec;
      if (nowSec < windowStart) {
        continue;
      }

      const baseWindow: SettlementWindowBase = {
        poolId: pool.poolId,
        assetId: pool.assetId,
        name: pool.name,
        windowId,
        windowStart,
        resolutionDeadline,
        totalPool: totalPool.toString(),
        unresolved,
        canSettleNow: nowSec >= resolutionDeadline,
        canFinalizeUnresolved: unresolved && nowSec >= resolutionDeadline,
        hookAddress
      };

      if (nowSec < resolutionDeadline) {
        awaitingClose.push({
          ...baseWindow,
          unsettledStatus: "awaiting_close",
          canSettleNow: false,
          canFinalizeUnresolved: false
        });
        continue;
      }

      pending.push({
        ...baseWindow,
        unsettledStatus: unresolved ? "finalizable_unresolved" : "ready_to_settle"
      });
    }
  }

  pending.sort((a, b) => a.windowStart - b.windowStart || a.assetId.localeCompare(b.assetId));
  awaitingClose.sort((a, b) => a.windowStart - b.windowStart || a.assetId.localeCompare(b.assetId));

  return { pending, awaitingClose };
}

export async function settleWindowAsAdmin(input: { poolId?: string; assetId?: string; windowId: number }): Promise<{
  action: "settle" | "finalize_unresolved";
  txHash: Hex;
  poolId: `0x${string}`;
  assetId: string;
  windowId: number;
}> {
  const pool = resolvePool(input);
  if (!pool.priceFeedId && input.windowId >= 0) {
    throw new Error(`Pool ${pool.assetId} is missing priceFeedId`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const publicClient = getPublicClient();
  const walletClient = getKeeperWalletClient();
  const keeperAccount = getKeeperAccount();
  const hookAddress = getAddress(pool.poolKey.hooks);

  const [totalPool, settled, voided, unresolved] = await publicClient.readContract({
    address: hookAddress,
    abi: pariHookKeeperAbi,
    functionName: "getWindow",
    args: [pool.poolKey, BigInt(input.windowId)]
  });

  if (settled) {
    throw new Error("Window already settled");
  }
  if (voided) {
    throw new Error("Window already voided");
  }
  if (totalPool === 0n && !unresolved) {
    throw new Error("Window has no unsettled stake");
  }

  const windowStart = pool.gridEpoch + input.windowId * pool.windowDurationSec;
  if (nowSec < windowStart) {
    throw new Error("Window not started");
  }

  const resolutionDeadline = windowStart + pool.windowDurationSec;
  if (nowSec < resolutionDeadline) {
    throw new Error("Window not closed yet");
  }

  if (unresolved) {
    const txHash = await walletClient.writeContract({
      account: keeperAccount,
      address: hookAddress,
      abi: pariHookKeeperAbi,
      functionName: "finalizeUnresolved",
      args: [pool.poolKey, BigInt(input.windowId)]
    });

    return {
      action: "finalize_unresolved",
      txHash,
      poolId: pool.poolId,
      assetId: pool.assetId,
      windowId: input.windowId
    };
  }

  const pythAddress = getAddress(env.PYTH_CONTRACT_ADDRESS as `0x${string}`);
  const vaa = await fetchPythVaa(pool.priceFeedId as string, windowStart);
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
    args: [pool.poolKey, BigInt(input.windowId), vaa],
    value: updateFee
  });

  return {
    action: "settle",
    txHash,
    poolId: pool.poolId,
    assetId: pool.assetId,
    windowId: input.windowId
  };
}

function filterPools(input?: { poolId?: string; assetId?: string }): KeeperPoolConfig[] {
  const pools = getKeeperPools();
  if (input?.poolId) {
    const pool = getKeeperPoolByPoolId(input.poolId);
    return pool ? [pool] : [];
  }
  if (input?.assetId) {
    return pools.filter((pool) => pool.assetId === input.assetId);
  }
  return pools;
}

function resolvePool(input: { poolId?: string; assetId?: string }): KeeperPoolConfig {
  const pools = filterPools(input);
  if (pools.length === 0) {
    throw new Error("Keeper pool not found");
  }
  if (pools.length > 1) {
    throw new Error("Multiple pools matched; provide poolId");
  }
  return pools[0];
}
