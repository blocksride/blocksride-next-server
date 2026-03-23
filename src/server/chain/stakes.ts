import { getAddress } from "viem";

import { getPublicClient } from "@/server/chain/client";
import type { KeeperPoolConfig } from "@/server/config/pools";

const FROZEN_WINDOWS = 3;
const BETTABLE_COUNT = 3;
const CACHE_TTL_MS = 10_000;

const STAKES_ABI = [
  {
    name: "cellStakes",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "windowId", type: "uint256" },
      { name: "cellId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "windowTotals",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "windowId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "currentWindowId",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type StakesSnapshot = {
  windowIds: number[];
  windowTotals: Record<number, number>;   // USDC
  cellStakes: Record<string, number>;     // key: `${windowId}_${cellId}`, value: USDC
  updatedAt: number;
};

type CacheEntry = { snapshot: StakesSnapshot; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export async function getStakesSnapshot(
  pool: KeeperPoolConfig,
  minCellId: number,
  maxCellId: number,
): Promise<StakesSnapshot> {
  const cacheKey = `${pool.poolId}:${minCellId}:${maxCellId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.snapshot;
  }

  const publicClient = getPublicClient();
  const hookAddress = getAddress(pool.poolKey.hooks);

  const currentWindowId = Number(
    await publicClient.readContract({
      address: hookAddress,
      abi: STAKES_ABI,
      functionName: "currentWindowId",
      args: [pool.poolKey],
    })
  );

  const windowIds: number[] = [];
  for (let i = 1; i <= BETTABLE_COUNT; i++) {
    windowIds.push(currentWindowId + FROZEN_WINDOWS + i);
  }

  const cellIds: number[] = [];
  for (let c = minCellId; c <= maxCellId; c++) {
    cellIds.push(c);
  }

  type MulticallResult = { status: "success" | "failure"; result: unknown };

  const totalCalls = windowIds.length + windowIds.length * cellIds.length;
  const rawResults: MulticallResult[] = await publicClient.multicall({
    contracts: [
      ...windowIds.map((wid) => ({
        address: hookAddress,
        abi: STAKES_ABI,
        functionName: "windowTotals" as const,
        args: [pool.poolId as `0x${string}`, BigInt(wid)] as const,
      })),
      ...windowIds.flatMap((wid) =>
        cellIds.map((cid) => ({
          address: hookAddress,
          abi: STAKES_ABI,
          functionName: "cellStakes" as const,
          args: [pool.poolId as `0x${string}`, BigInt(wid), BigInt(cid)] as const,
        }))
      ),
    ],
    allowFailure: true,
  }) as MulticallResult[];

  void totalCalls;

  const windowTotals: Record<number, number> = {};
  const cellStakes: Record<string, number> = {};

  for (let i = 0; i < windowIds.length; i++) {
    const r = rawResults[i];
    if (r?.status === "success" && r.result != null) {
      windowTotals[windowIds[i]] = Number(r.result as bigint) / 1_000_000;
    }
  }

  const offset = windowIds.length;
  for (let wi = 0; wi < windowIds.length; wi++) {
    for (let ci = 0; ci < cellIds.length; ci++) {
      const r = rawResults[offset + wi * cellIds.length + ci];
      if (r?.status === "success" && r.result != null) {
        const stake = r.result as bigint;
        if (stake > 0n) {
          cellStakes[`${windowIds[wi]}_${cellIds[ci]}`] = Number(stake) / 1_000_000;
        }
      }
    }
  }

  const snapshot: StakesSnapshot = {
    windowIds,
    windowTotals,
    cellStakes,
    updatedAt: Date.now(),
  };

  cache.set(cacheKey, { snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
  return snapshot;
}
