import { randomUUID } from "node:crypto";

import type { PracticePosition } from "@/shared/positions";

type CreatePracticePositionInput = {
  userId: string;
  assetId: string;
  cellId: string;
  stake: number;
};

const practicePositions = new Map<string, PracticePosition[]>();

export function listPracticePositions(userId: string): PracticePosition[] {
  return practicePositions.get(userId) ?? [];
}

export function createPracticePosition(input: CreatePracticePositionInput): PracticePosition {
  const position: PracticePosition = {
    position_id: randomUUID(),
    user_id: input.userId,
    asset_id: input.assetId,
    cell_id: input.cellId,
    stake: input.stake,
    state: "ACTIVE",
    is_practice: true,
    created_at: new Date().toISOString(),
    payout: 0,
    potential_payout: input.stake
  };

  const existing = practicePositions.get(input.userId) ?? [];
  practicePositions.set(input.userId, [position, ...existing]);
  return position;
}
