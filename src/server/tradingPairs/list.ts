import { getKeeperPools } from "@/server/config/pools";
import type { TradingPair } from "@/shared/tradingPairs";

export function listTradingPairs(): TradingPair[] {
  const now = new Date().toISOString();

  return getKeeperPools().map((pool) => ({
    asset_id: pool.assetId,
    symbol: pool.assetId,
    quote: pool.assetId.split("-")[1] ?? "USD",
    price_source: "coinbase",
    tick_size: 0.01,
    timeframe_sec: pool.windowDurationSec,
    price_interval: 2,
    num_windows: 60,
    bands_above: 12,
    bands_below: 12,
    status: "active",
    created_at: new Date(pool.gridEpoch * 1000).toISOString(),
    updated_at: now
  }));
}
