import { getAddress, isAddress } from "viem";

import { usdcAbi } from "@/shared/abi/usdc";
import { env } from "@/server/config/env";
import { getPublicClient, getRelayerAccount } from "@/server/chain/client";

function getTokenAddress(): `0x${string}` {
  const token = env.USDC_TOKEN_ADDRESS;
  if (!token || !isAddress(token)) {
    throw new Error("USDC_TOKEN_ADDRESS is required and must be a valid address");
  }
  return getAddress(token);
}

export async function getPermitInfo(address: string) {
  if (!isAddress(address)) {
    throw new Error("address query parameter is required and must be valid");
  }

  const user = getAddress(address);
  const publicClient = getPublicClient();
  const tokenAddress = getTokenAddress();
  const nonce = await publicClient.readContract({
    address: tokenAddress,
    abi: usdcAbi,
    functionName: "nonces",
    args: [user]
  });
  const chainId = await publicClient.getChainId();

  return {
    nonce: nonce.toString(),
    relayerAddress: getRelayerAccount().address,
    treasuryAddress: env.PLATFORM_TREASURY ?? "",
    tokenAddress,
    chainId: String(chainId)
  };
}
