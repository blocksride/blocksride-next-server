import { getAddress, isAddress } from "viem";

import { usdcAbi } from "@/shared/abi/usdc";
import { env } from "@/server/config/env";
import { getPublicClient } from "@/server/chain/client";


function getSpenderAddress(): `0x${string}` {
  const hook = env.PARIHOOK_CONTRACT_ADDRESS;
  if (!hook || !isAddress(hook)) {
    throw new Error("PARIHOOK_CONTRACT_ADDRESS is required and must be a valid address");
  }
  return getAddress(hook);
}

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
  const [nonce, domainName, domainVersion, chainId] = await Promise.all([
    publicClient.readContract({ address: tokenAddress, abi: usdcAbi, functionName: "nonces", args: [user] }),
    publicClient.readContract({ address: tokenAddress, abi: usdcAbi, functionName: "name" }),
    publicClient.readContract({ address: tokenAddress, abi: usdcAbi, functionName: "version" }),
    publicClient.getChainId(),
  ]);

  const spenderAddress = getSpenderAddress();

  return {
    nonce: nonce.toString(),
    tokenAddress,
    chainId: String(chainId),
    spenderAddress,
    hookAddress: spenderAddress,
    domainName,
    domainVersion,
  };
}
