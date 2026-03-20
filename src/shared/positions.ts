export type PracticePosition = {
  position_id: string;
  user_id: string;
  asset_id: string;
  cell_id: string;
  stake: number;
  state: "ACTIVE";
  is_practice: true;
  created_at: string;
  payout?: number;
  result?: string;
  resolved_at?: string;
  shares_bought?: number;
  purchase_price?: number;
  potential_payout?: number;
};
