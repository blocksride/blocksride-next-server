import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

import { env } from "@/server/config/env";

function resolveChain() {
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
