export type SessionUser = {
  id: string;
  email: string;
  nickname: string;
  wallet_address: string;
  balance: number;
  practice_balance: number;
  has_seen_betting_onboarding: boolean;
};

export type SessionPayload = {
  user_id: string;
  exp: number;
};
