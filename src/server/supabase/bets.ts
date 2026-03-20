import { env } from "@/server/config/env";

const REST_BASE_PATH = "/rest/v1";

export type BetState = "pending" | "confirmed" | "won" | "lost" | "voided";

export type BetRecord = {
  intent_id: string;
  wallet_address: string;
  pool_id: string;
  pool_key: object;
  window_id: string;
  cell_id: string;
  amount: string;
  state: BetState;
  tx_hash?: string | null;
  payout?: string | null;
  created_at?: string;
  updated_at?: string;
};

// In-memory fallback when Supabase is unavailable.
// Use globalThis so all Next.js route bundles share the same Map within one Node.js process.
declare global {
  // eslint-disable-next-line no-var
  var __inMemoryBets: Map<string, BetRecord> | undefined;
}
const inMemoryBets: Map<string, BetRecord> = (globalThis.__inMemoryBets ??= new Map());

function getRequiredConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getRequiredConfig();
  if (!config) {
    throw new Error("Supabase not configured");
  }

  const response = await fetch(`${config.baseUrl}${REST_BASE_PATH}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    body: init?.body,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`supabase rest error: ${await response.text()}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function saveBetRecord(record: BetRecord): Promise<void> {
  inMemoryBets.set(record.intent_id, { ...record, updated_at: new Date().toISOString() });

  try {
    await supabaseRequest<void>("/bet_records?on_conflict=intent_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ ...record, updated_at: new Date().toISOString() }])
    });
  } catch {
    // Keep in-memory fallback
  }
}

export async function updateBetRecord(intentId: string, patch: Partial<BetRecord>): Promise<void> {
  const existing = inMemoryBets.get(intentId);
  if (existing) {
    inMemoryBets.set(intentId, { ...existing, ...patch, updated_at: new Date().toISOString() });
  }

  try {
    await supabaseRequest<void>(`/bet_records?intent_id=eq.${encodeURIComponent(intentId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    });
  } catch {
    // Keep in-memory fallback
  }
}

export async function getBetRecordsByWallet(walletAddress: string, limit = 100): Promise<BetRecord[]> {
  const normalized = walletAddress.toLowerCase();

  try {
    return await supabaseRequest<BetRecord[]>(
      `/bet_records?wallet_address=eq.${encodeURIComponent(normalized)}&order=created_at.desc&limit=${limit}`
    );
  } catch {
    return Array.from(inMemoryBets.values())
      .filter((b) => b.wallet_address.toLowerCase() === normalized)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, limit);
  }
}

export async function getConfirmedBetRecords(limit = 500): Promise<BetRecord[]> {
  try {
    return await supabaseRequest<BetRecord[]>(
      `/bet_records?state=eq.confirmed&order=created_at.desc&limit=${limit}`
    );
  } catch {
    return Array.from(inMemoryBets.values()).filter((b) => b.state === "confirmed");
  }
}

export async function updateWindowBetOutcomes(
  poolId: string,
  windowId: string,
  winningCell: string | null,
  redemptionRate: bigint,
  voided: boolean
): Promise<void> {
  // Update in-memory
  for (const [id, bet] of inMemoryBets.entries()) {
    if (bet.pool_id.toLowerCase() !== poolId.toLowerCase() || bet.window_id !== windowId || bet.state !== "confirmed") {
      continue;
    }

    let newState: BetState;
    let payout: string | null = null;

    if (voided) {
      newState = "voided";
      payout = bet.amount; // refund
    } else if (winningCell !== null && bet.cell_id === winningCell) {
      newState = "won";
      // payout = amount * redemptionRate / 1e18 (rate is in 18-decimal fixed point)
      const amountBn = BigInt(bet.amount);
      const payoutBn = (amountBn * redemptionRate) / BigInt(1e18);
      payout = payoutBn.toString();
    } else {
      newState = "lost";
    }

    inMemoryBets.set(id, { ...bet, state: newState, payout, updated_at: new Date().toISOString() });
  }

  // Update Supabase
  try {
    if (voided) {
      await supabaseRequest<void>(
        `/bet_records?pool_id=eq.${encodeURIComponent(poolId)}&window_id=eq.${encodeURIComponent(windowId)}&state=eq.confirmed`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ state: "voided", updated_at: new Date().toISOString() })
        }
      );
    } else if (winningCell !== null) {
      // Mark winners
      await supabaseRequest<void>(
        `/bet_records?pool_id=eq.${encodeURIComponent(poolId)}&window_id=eq.${encodeURIComponent(windowId)}&state=eq.confirmed&cell_id=eq.${encodeURIComponent(winningCell)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ state: "won", updated_at: new Date().toISOString() })
        }
      );
      // Mark losers
      await supabaseRequest<void>(
        `/bet_records?pool_id=eq.${encodeURIComponent(poolId)}&window_id=eq.${encodeURIComponent(windowId)}&state=eq.confirmed&cell_id=neq.${encodeURIComponent(winningCell)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ state: "lost", updated_at: new Date().toISOString() })
        }
      );
    }
  } catch {
    // In-memory was already updated above
  }
}
