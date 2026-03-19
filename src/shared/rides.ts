export type Ride = {
  contest_id: string;
  name: string;
  description?: string | null;
  asset_id: string;
  grid_id?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  price_interval?: number | null;
  timeframe_sec?: number | null;
  bands_above?: number | null;
  bands_below?: number | null;
  frozen_windows?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type LeaderboardEntry = {
  id: number;
  contest_id: string;
  user_id: string;
  wallet_address?: string | null;
  total_volume: number;
  net_pnl: number;
  rank: number;
  updated_at: string;
};
