import type { SessionUser } from "@/shared/auth";
import { env } from "@/server/config/env";
import { getUserProfile, upsertUserProfile } from "@/server/supabase/client";

export type PrivyAccount = {
  type: string;
  address?: string;
  chain_type?: string;
  chain_id?: string;
  email?: string;
  wallet_client_type?: string;
};

export type PrivyClaims = {
  id: string;
  linked_accounts: PrivyAccount[];
};

export async function verifyPrivyToken(accessToken: string, requestedWalletAddress?: string): Promise<SessionUser> {
  const userDid = extractUserDidFromToken(accessToken);
  const claims = await fetchPrivyUser(userDid);

  let walletAddress = getEmbeddedWalletAddress(claims) || requestedWalletAddress || "";
  walletAddress = walletAddress.toLowerCase();
  const userId = walletAddress || claims.id.toLowerCase();
  if (!userId) {
    throw new Error("Invalid Privy response: no user identifier");
  }

  const email = getEmail(claims) || `${claims.id}@privy.local`;
  const existing = await getUserProfile(userId).catch(() => null);
  const nickname = existing?.nickname ?? "";
  const hasSeenBettingOnboarding = existing?.onboarding_completed ?? false;

  await upsertUserProfile({
    user_id: userId,
    email,
    wallet_address: walletAddress,
    nickname,
    onboarding_completed: hasSeenBettingOnboarding
  }).catch(() => undefined);

  return {
    id: userId,
    email,
    nickname,
    wallet_address: walletAddress || userId,
    balance: 0,
    practice_balance: 0,
    has_seen_betting_onboarding: hasSeenBettingOnboarding
  };
}

function extractUserDidFromToken(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid JWT format");
  }
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { sub?: string };
  if (!payload.sub) {
    throw new Error("no subject in token");
  }
  return payload.sub;
}

async function fetchPrivyUser(userDid: string): Promise<PrivyClaims> {
  if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET are required");
  }

  const basicAuth = Buffer.from(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`).toString("base64");
  const response = await fetch(`https://auth.privy.io/api/v1/users/${userDid}`, {
    method: "GET",
    headers: {
      "privy-app-id": env.PRIVY_APP_ID,
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Privy API returned status ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as PrivyClaims;
}

function getEmbeddedWalletAddress(claims: PrivyClaims): string {
  for (const account of claims.linked_accounts) {
    if (account.type === "wallet" && account.wallet_client_type === "privy" && account.address) {
      return account.address;
    }
  }
  for (const account of claims.linked_accounts) {
    if (account.type === "wallet" && (account.chain_type === "ethereum" || !account.chain_type) && account.address) {
      return account.address;
    }
  }
  return "";
}

function getEmail(claims: PrivyClaims): string {
  for (const account of claims.linked_accounts) {
    if (account.type === "email" && account.email) {
      return account.email;
    }
  }
  return "";
}
