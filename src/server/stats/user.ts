import { listPracticePositions } from "@/server/practice/positions";
import type { ActivityDay, UserStats } from "@/shared/stats";

export function getUserStatsSummary(userId: string): UserStats {
  const positions = listPracticePositions(userId);
  const historyMap = new Map<string, ActivityDay>();

  for (const position of positions) {
    const date = position.created_at.slice(0, 10);
    const existing = historyMap.get(date) ?? { date, count: 0, pnl: 0, volume: 0 };
    existing.count += 1;
    existing.volume += position.stake;
    existing.pnl += position.payout ?? 0;
    historyMap.set(date, existing);
  }

  return {
    total_bets: positions.length,
    total_volume: positions.reduce((sum, position) => sum + position.stake, 0),
    net_pnl: positions.reduce((sum, position) => sum + (position.payout ?? 0), 0),
    win_rate: 0,
    history: [...historyMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  };
}
