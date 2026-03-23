import { env } from "@/server/config/env";

const REST_BASE_PATH = "/rest/v1";

export type WithdrawalState = "pending" | "completed" | "failed";

export type WithdrawalRecord = {
  id?: string;
  wallet_address: string;
  to_address: string;
  amount: string;       // raw USDC units
  fee: string;          // raw USDC units
  tx_hash?: string | null;
  state: WithdrawalState;
  created_at?: string;
  updated_at?: string;
};

const inMemory = new Map<string, WithdrawalRecord>();

function getConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error("Supabase not configured");
  const response = await fetch(`${config.baseUrl}${REST_BASE_PATH}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`supabase rest error: ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function saveWithdrawalRecord(record: WithdrawalRecord): Promise<string | null> {
  const row = { ...record, updated_at: new Date().toISOString() };
  try {
    const rows = await supabaseRequest<{ id: string }[]>("/withdrawal_records?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([row]),
    });
    const id = rows[0]?.id ?? null;
    if (id) inMemory.set(id, { ...row, id });
    return id;
  } catch {
    const id = crypto.randomUUID();
    inMemory.set(id, { ...row, id });
    return id;
  }
}

export async function updateWithdrawalRecord(id: string, patch: Partial<WithdrawalRecord>): Promise<void> {
  const existing = inMemory.get(id);
  if (existing) inMemory.set(id, { ...existing, ...patch, updated_at: new Date().toISOString() });
  try {
    await supabaseRequest<void>(`/withdrawal_records?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
  } catch {
    // in-memory already updated
  }
}

export async function getWithdrawalsByWallet(walletAddress: string, limit = 50): Promise<WithdrawalRecord[]> {
  const normalized = walletAddress.toLowerCase();
  try {
    return await supabaseRequest<WithdrawalRecord[]>(
      `/withdrawal_records?wallet_address=eq.${encodeURIComponent(normalized)}&order=created_at.desc&limit=${limit}`
    );
  } catch {
    return Array.from(inMemory.values())
      .filter((r) => r.wallet_address.toLowerCase() === normalized)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, limit);
  }
}
