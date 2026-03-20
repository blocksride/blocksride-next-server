import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import { env } from "@/server/config/env";

export function resolveChain() {
  if (env.NETWORK === "mainnet") {
    return base;
  }
  return baseSepolia;
}

export function getPublicClient() {
  return createPublicClient({
    chain: resolveChain(),
    transport: http(env.RPC_URL)
  });
}

export function getRelayerAccount() {
  const key = env.RELAYER_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) {
    throw new Error("RELAYER_PRIVATE_KEY is required");
  }
  return privateKeyToAccount(key as `0x${string}`);
}

export function getKeeperAccount() {
  const key = env.KEEPER_PRIVATE_KEY ?? env.RELAYER_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) {
    throw new Error("KEEPER_PRIVATE_KEY or RELAYER_PRIVATE_KEY is required");
  }
  return privateKeyToAccount(key as `0x${string}`);
}

export function getWalletClient() {
  return createWalletClient({
    account: getRelayerAccount(),
    chain: resolveChain(),
    transport: http(env.RPC_URL)
  });
}

export function getKeeperWalletClient() {
  return createWalletClient({
    account: getKeeperAccount(),
    chain: resolveChain(),
    transport: http(env.RPC_URL)
  });
}

export function normalizeAddress(value: string, field: string): `0x${string}` {
  if (!value || !value.startsWith("0x")) {
    throw new Error(`${field} must be a valid address`);
  }
  return getAddress(value);
}
