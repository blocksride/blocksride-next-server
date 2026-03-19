import { isAddress } from "viem";

import { getPublicClient } from "@/server/chain/client";
import { pariHookNonceAbi } from "@/shared/abi/pariHookNonce";
import { env } from "@/server/config/env";

function getHookAddress() {
  const address = env.PARIHOOK_CONTRACT_ADDRESS;
  if (!address || !isAddress(address)) {
    throw new Error("PARIHOOK_CONTRACT_ADDRESS is required and must be a valid address");
  }
  return address;
}

export async function getBetNonce(address: string): Promise<bigint> {
  if (!isAddress(address)) {
    throw new Error("invalid address");
  }
  return getPublicClient().readContract({
    address: getHookAddress(),
    abi: pariHookNonceAbi,
    functionName: "betNonces",
    args: [address]
  });
}

export async function getClaimNonce(address: string): Promise<bigint> {
  if (!isAddress(address)) {
    throw new Error("invalid address");
  }
  return getPublicClient().readContract({
    address: getHookAddress(),
    abi: pariHookNonceAbi,
    functionName: "claimNonces",
    args: [address]
  });
}
