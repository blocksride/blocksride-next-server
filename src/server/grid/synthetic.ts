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

export type SyntheticCell = {
  cell_id: string;       // "{windowId}_{cellId}"
  grid_id: string;
  p_low: number;
  p_high: number;
  t_start: string;       // ISO
  t_end: string;         // ISO
  result?: string;
};

// Generate a grid of cells centred on anchorPrice.
// Columns: pastWindows behind + 1 current + futureWindows ahead
// Rows: rowCount price bands of priceInterval width
export function getSyntheticCells(
  gridId: string,
  anchorPrice: number,
  options?: { rowCount?: number; pastWindows?: number; futureWindows?: number; priceInterval?: number; windowDurationSec?: number }
): SyntheticCell[] {
  if (!anchorPrice || anchorPrice <= 0) return [];

  const pool = getKeeperPools().find((p) => `${p.assetId}-live` === gridId);
  const windowDurationSec = options?.windowDurationSec ?? pool?.windowDurationSec ?? 60;
  const priceInterval = options?.priceInterval ?? 2;
  const rowCount = options?.rowCount ?? 10;
  const pastWindows = options?.pastWindows ?? 4;
  const futureWindows = options?.futureWindows ?? 5;

  const nowSec = Math.floor(Date.now() / 1000);
  const currentWindowId = Math.floor(nowSec / windowDurationSec);

  // Anchor the price grid: round to nearest priceInterval
  const anchorBand = Math.round(anchorPrice / priceInterval);
  const halfRows = Math.floor(rowCount / 2);

  const cells: SyntheticCell[] = [];

  for (let col = -pastWindows; col <= futureWindows; col++) {
    const windowId = currentWindowId + col;
    const tStartSec = windowId * windowDurationSec;
    const tEndSec = tStartSec + windowDurationSec;
    const t_start = new Date(tStartSec * 1000).toISOString();
    const t_end = new Date(tEndSec * 1000).toISOString();

    for (let row = -halfRows; row < rowCount - halfRows; row++) {
      const bandIndex = anchorBand + row;
      const p_low = bandIndex * priceInterval;
      const p_high = p_low + priceInterval;
      const cellId = bandIndex; // numeric cell index

      cells.push({
        cell_id: `${windowId}_${cellId}`,
        grid_id: gridId,
        p_low,
        p_high,
        t_start,
        t_end,
      });
    }
  }

  return cells;
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
