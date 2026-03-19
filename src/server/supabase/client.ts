import { env } from "@/server/config/env";
import type { LeaderboardEntry, Ride } from "@/shared/rides";

const REST_BASE_PATH = "/rest/v1";

function getRequiredSupabaseConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function supabaseRequest<T>(path: string): Promise<T> {
  const { baseUrl, serviceRoleKey } = getRequiredSupabaseConfig();
  const response = await fetch(`${baseUrl}${REST_BASE_PATH}${path}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`supabase rest error: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function getActiveRide(): Promise<Ride | null> {
  const rides = await supabaseRequest<Ride[]>("/contests?status=eq.active&order=start_time.asc&limit=1");
  return rides[0] ?? null;
}

export async function getUpcomingRides(limit = 10): Promise<Ride[]> {
  return supabaseRequest<Ride[]>(`/contests?status=eq.upcoming&order=start_time.asc&limit=${limit}`);
}

export async function getRideLeaderboard(rideId: string, limit = 10): Promise<LeaderboardEntry[]> {
  if (!rideId) {
    return [];
  }

  return supabaseRequest<LeaderboardEntry[]>(
    `/leaderboard_entries?contest_id=eq.${encodeURIComponent(rideId)}&order=rank.asc&limit=${limit}`
  );
}
