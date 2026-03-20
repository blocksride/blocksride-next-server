export type ActivityDay = {
  date: string;
  count: number;
  pnl: number;
  volume: number;
};

export type UserStats = {
  total_bets: number;
  total_volume: number;
  net_pnl: number;
  win_rate: number;
  history: ActivityDay[];
};
