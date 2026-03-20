import { encodeAbiParameters, getAddress, isAddress, keccak256 } from "viem";

import { env } from "@/server/config/env";

export type PoolKeyConfig = {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
};

export type KeeperPoolConfig = {
  name?: string;
  poolId: `0x${string}`;
  poolKey: PoolKeyConfig;
  assetId: string;
  priceFeedId?: string;
  gridEpoch: number;
  windowDurationSec: number;
  fromBlock?: number;
};

type RawKeeperPoolConfig = {
  name?: string;
  poolId?: string;
  poolKey?: {
    currency0?: string;
    currency1?: string;
    fee?: number;
    tickSpacing?: number;
    hooks?: string;
  };
  assetId?: string;
  priceFeedId?: string;
  gridEpoch?: number;
  windowDurationSec?: number;
  fromBlock?: number;
};

let cachedPools: KeeperPoolConfig[] | null = null;

export function getKeeperPools(): KeeperPoolConfig[] {
  if (cachedPools) {
    return cachedPools;
  }

  const raw = env.KEEPER_POOLS;
  if (!raw) {
    cachedPools = [];
    return cachedPools;
  }

  const parsed = JSON.parse(raw) as RawKeeperPoolConfig[];
  cachedPools = parsed.map((pool, index) => {
    if (!pool.poolKey) {
      throw new Error(`KEEPER_POOLS[${index}] is missing poolKey`);
    }
    const poolKey: PoolKeyConfig = {
      currency0: normalizeAddress(pool.poolKey.currency0, `KEEPER_POOLS[${index}].poolKey.currency0`),
      currency1: normalizeAddress(pool.poolKey.currency1, `KEEPER_POOLS[${index}].poolKey.currency1`),
      fee: normalizeNumber(pool.poolKey.fee, `KEEPER_POOLS[${index}].poolKey.fee`),
      tickSpacing: normalizeNumber(pool.poolKey.tickSpacing, `KEEPER_POOLS[${index}].poolKey.tickSpacing`),
      hooks: normalizeAddress(pool.poolKey.hooks, `KEEPER_POOLS[${index}].poolKey.hooks`)
    };

    return {
      name: pool.name,
      poolId: normalizePoolId(pool.poolId) ?? computePoolId(poolKey),
      poolKey,
      assetId: pool.assetId ?? "",
      priceFeedId: pool.priceFeedId,
      gridEpoch: normalizeNumber(pool.gridEpoch, `KEEPER_POOLS[${index}].gridEpoch`),
      windowDurationSec: normalizeNumber(pool.windowDurationSec, `KEEPER_POOLS[${index}].windowDurationSec`),
      fromBlock: pool.fromBlock
    };
  });

  return cachedPools;
}

export function getKeeperPoolByPoolId(poolId: string): KeeperPoolConfig | null {
  const normalized = normalizePoolId(poolId);
  if (!normalized) {
    return null;
  }
  return getKeeperPools().find((pool) => pool.poolId.toLowerCase() === normalized.toLowerCase()) ?? null;
}

function computePoolId(poolKey: PoolKeyConfig): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" }
      ],
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
  );
}

function normalizeAddress(value: string | undefined, field: string): `0x${string}` {
  if (!value || !isAddress(value)) {
    throw new Error(`${field} must be a valid address`);
  }
  return getAddress(value);
}

function normalizeNumber(value: number | undefined, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

function normalizePoolId(value: string | undefined): `0x${string}` | null {
  if (!value) {
    return null;
  }
  const lower = value.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(lower)) {
    throw new Error("KEEPER_POOLS poolId must be 32-byte hex");
  }
  return lower as `0x${string}`;
}
