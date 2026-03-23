import { env } from "@/server/config/env";

const REST_BASE_PATH = "/rest/v1";

// In-memory fallback when Supabase is unavailable.
const inMemoryCursors = new Map<string, bigint>();

function getRequiredConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getRequiredConfig();
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

export async function getKeeperCursor(key: string): Promise<bigint | null> {
  const cached = inMemoryCursors.get(key);

  try {
    const rows = await supabaseRequest<{ block_number: string }[]>(
      `/keeper_cursors?key=eq.${encodeURIComponent(key)}&limit=1`
    );
    const value = rows[0] ? BigInt(rows[0].block_number) : null;
    if (value !== null) inMemoryCursors.set(key, value);
    return value;
  } catch {
    return cached ?? null;
  }
}

export async function setKeeperCursor(key: string, blockNumber: bigint): Promise<void> {
  inMemoryCursors.set(key, blockNumber);

  try {
    await supabaseRequest<void>("/keeper_cursors?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ key, block_number: blockNumber.toString(), updated_at: new Date().toISOString() }]),
    });
  } catch {
    // In-memory fallback already updated above
  }
}
