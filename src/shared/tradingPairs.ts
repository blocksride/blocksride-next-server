export type TradingPair = {
  asset_id: string;
  symbol: string;
  quote: string;
  price_source: string;
  tick_size: number;
  timeframe_sec: number;
  price_interval: number;
  num_windows: number;
  bands_above: number;
  bands_below: number;
  status: string;
  created_at: string;
  updated_at: string;
};
