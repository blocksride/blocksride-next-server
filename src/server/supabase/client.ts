import { env } from "@/server/config/env";
import { getKeeperPools } from "@/server/config/pools";
import type { LeaderboardEntry, Ride } from "@/shared/rides";

export type UserProfile = {
  user_id: string;
  email?: string | null;
  wallet_address?: string | null;
  nickname?: string | null;
  onboarding_completed: boolean;
};

const REST_BASE_PATH = "/rest/v1";

const profileFallbacks = new Map<string, UserProfile>();

function getFallbackProfile(userId: string): UserProfile | null {
  return profileFallbacks.get(userId) ?? null;
}

function setFallbackProfile(profile: UserProfile): void {
  profileFallbacks.set(profile.user_id, profile);
}

function mergeProfiles(primary: UserProfile | null, fallback: UserProfile | null): UserProfile | null {
  if (!primary && !fallback) return null;
  if (!primary) return fallback;
  if (!fallback) return primary;

  return {
    ...primary,
    ...fallback,
    onboarding_completed: fallback.onboarding_completed || primary.onboarding_completed,
  };
}

function syntheticContestId(assetId: string): string {
  return `${assetId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-live`;
}

function toSyntheticRide(pool: ReturnType<typeof getKeeperPools>[number], status: string): Ride {
  const startTime = new Date(pool.gridEpoch * 1000).toISOString();
  const endTime = new Date(Math.max(Date.now(), pool.gridEpoch * 1000) + 365 * 24 * 60 * 60 * 1000).toISOString();

  return {
    contest_id: syntheticContestId(pool.assetId),
    name: pool.name ?? pool.assetId,
    description: `${pool.assetId} ride`,
    asset_id: pool.assetId,
    grid_id: `${pool.assetId}-live`,
    start_time: startTime,
    end_time: endTime,
    status,
    price_interval: 2,
    timeframe_sec: pool.windowDurationSec,
    bands_above: 12,
    bands_below: 12,
    frozen_windows: 2,
    created_at: startTime,
    updated_at: new Date().toISOString(),
  };
}

function getActiveSyntheticRide(): Ride | null {
  const nowSec = Math.floor(Date.now() / 1000);
  const pool = getKeeperPools()
    .filter((item) => item.gridEpoch <= nowSec)
    .sort((a, b) => b.gridEpoch - a.gridEpoch)[0] ?? getKeeperPools()[0] ?? null;
  return pool ? toSyntheticRide(pool, "active") : null;
}

function getUpcomingSyntheticRides(limit = 10): Ride[] {
  const nowSec = Math.floor(Date.now() / 1000);
  return getKeeperPools()
    .filter((item) => item.gridEpoch > nowSec)
    .sort((a, b) => a.gridEpoch - b.gridEpoch)
    .slice(0, limit)
    .map((pool) => toSyntheticRide(pool, "upcoming"));
}

function getSyntheticRideById(rideId: string): Ride | null {
  const lower = rideId.toLowerCase();
  const pool = getKeeperPools().find((item) => {
    const syntheticId = syntheticContestId(item.assetId);
    return syntheticId === lower || item.assetId.toLowerCase() === lower || item.poolId.toLowerCase() === lower;
  }) ?? null;

  if (!pool) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  return toSyntheticRide(pool, pool.gridEpoch > nowSec ? "upcoming" : "active");
}

function getRequiredSupabaseConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, serviceRoleKey } = getRequiredSupabaseConfig();
  const response = await fetch(`${baseUrl}${REST_BASE_PATH}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
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

export async function getActiveRide(): Promise<Ride | null> {
  try {
    const rides = await supabaseRequest<Ride[]>("/contests?status=eq.active&order=start_time.asc&limit=1");
    return rides[0] ?? null;
  } catch {
    return getActiveSyntheticRide();
  }
}

export async function getUpcomingRides(limit = 10): Promise<Ride[]> {
  try {
    return await supabaseRequest<Ride[]>(`/contests?status=eq.upcoming&order=start_time.asc&limit=${limit}`);
  } catch {
    return getUpcomingSyntheticRides(limit);
  }
}

export async function getRideById(rideId: string): Promise<Ride | null> {
  if (!rideId) {
    return null;
  }

  try {
    const rides = await supabaseRequest<Ride[]>(`/contests?contest_id=eq.${encodeURIComponent(rideId)}&limit=1`);
    return rides[0] ?? null;
  } catch {
    return getSyntheticRideById(rideId);
  }
}

export async function getRideLeaderboard(rideId: string, limit = 10): Promise<LeaderboardEntry[]> {
  if (!rideId) {
    return [];
  }

  try {
    return await supabaseRequest<LeaderboardEntry[]>(
      `/leaderboard_entries?contest_id=eq.${encodeURIComponent(rideId)}&order=rank.asc&limit=${limit}`
    );
  } catch {
    return [];
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const fallback = getFallbackProfile(userId);

  try {
    const profiles = await supabaseRequest<UserProfile[]>(`/user_profiles?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    return mergeProfiles(profiles[0] ?? null, fallback);
  } catch {
    return fallback;
  }
}

export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  setFallbackProfile(profile);

  try {
    await supabaseRequest<void>("/user_profiles?on_conflict=user_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify([profile])
    });
  } catch {
    // Keep in-memory fallback when Supabase is unreachable.
  }
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  const fallback = getFallbackProfile(userId) ?? {
    user_id: userId,
    email: null,
    wallet_address: userId,
    nickname: null,
    onboarding_completed: false,
  };

  setFallbackProfile({
    ...fallback,
    onboarding_completed: true,
  });

  try {
    await supabaseRequest<void>(`/user_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ onboarding_completed: true })
    });
  } catch {
    // Keep in-memory onboarding state when Supabase is unreachable.
  }
}
