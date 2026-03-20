import type { KeeperPoolConfig } from "@/server/config/pools";
import type { Ride } from "@/shared/rides";
import { getKeeperPools } from "@/server/config/pools";

export type SyntheticGrid = {
  grid_id: string;
  asset_id: string;
  timeframe_sec: number;
  price_interval: number;
  anchor_price: number;
  start_time: string;
  end_time: string;
};

export function getActiveSyntheticGrids(assetId?: string, timeframeSec?: number): SyntheticGrid[] {
  return getKeeperPools()
    .filter((pool) => (assetId ? pool.assetId === assetId : true))
    .filter((pool) => (timeframeSec ? pool.windowDurationSec === timeframeSec : true))
    .map((pool) => toSyntheticGrid(pool));
}

export function getSyntheticCells(_gridId: string) {
  return [];
}

export function ensureSyntheticGrid(assetId: string, timeframeSec: number): SyntheticGrid | null {
  const pool = getKeeperPools().find((item) => item.assetId === assetId && item.windowDurationSec === timeframeSec);
  return pool ? toSyntheticGrid(pool) : null;
}

export function getSyntheticGridByContest(contest: Ride): SyntheticGrid | null {
  const timeframeSec = contest.timeframe_sec ?? 60;
  const synthetic = ensureSyntheticGrid(contest.asset_id, timeframeSec);
  if (synthetic) {
    return {
      ...synthetic,
      grid_id: contest.grid_id ?? synthetic.grid_id
    };
  }

  return {
    grid_id: contest.grid_id ?? `${contest.asset_id}-live`,
    asset_id: contest.asset_id,
    timeframe_sec: timeframeSec,
    price_interval: contest.price_interval ?? 2,
    anchor_price: 0,
    start_time: contest.start_time,
    end_time: contest.end_time
  };
}

function toSyntheticGrid(pool: KeeperPoolConfig): SyntheticGrid {
  return {
    grid_id: `${pool.assetId}-live`,
    asset_id: pool.assetId,
    timeframe_sec: pool.windowDurationSec,
    price_interval: 2,
    anchor_price: 0,
    start_time: new Date(pool.gridEpoch * 1000).toISOString(),
    end_time: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
}
