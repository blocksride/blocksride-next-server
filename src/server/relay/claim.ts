import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  recoverAddress,
  stringToHex,
  toHex,
  type Hex
} from "viem";

import type { ClaimIntent, PoolKeyInput, SubmitClaimRequest } from "@/shared/relay";
import { submitClaimRequestSchema } from "@/shared/relay";
import { env } from "@/server/config/env";
import { getPublicClient, getRelayerAccount, getWalletClient } from "@/server/chain/client";
import { pariHookWriteAbi } from "@/shared/abi/pariHookWrite";

const EIP712_DOMAIN_NAME = "PariHook";
const EIP712_DOMAIN_VERSION = "1";
const EIP712_DOMAIN_TYPEHASH = keccak256(
  stringToHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
);
const CLAIM_INTENT_TYPEHASH = keccak256(
  stringToHex("ClaimIntent(address user,bytes32 poolId,uint256[] windowIds,uint256 nonce,uint256 deadline)")
);

type SignatureParts = {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
};

function getHookAddress(): `0x${string}` {
  const address = env.PARIHOOK_CONTRACT_ADDRESS;
  if (!address || !isAddress(address)) {
    throw new Error("PARIHOOK_CONTRACT_ADDRESS is required and must be a valid address");
  }
  return getAddress(address);
}

export function parseSubmitClaimRequest(payload: unknown): SubmitClaimRequest {
  return submitClaimRequestSchema.parse(payload);
}

export function buildClaimIntent(request: SubmitClaimRequest): ClaimIntent {
  return {
    poolId: normalizeHex32(request.poolId, "poolId"),
    poolKey: normalizePoolKey(request.poolKey),
    windowIds: request.windowIds.map((value) => parseBigIntDecimal(value, "windowId")),
    nonce: parseBigIntDecimal(request.nonce, "nonce"),
    deadline: parseBigIntDecimal(request.deadline, "deadline"),
    user: normalizeAddress(request.user, "user"),
    signature: normalizeSignature(request.signature)
  };
}

export async function validateClaimIntent(intent: ClaimIntent): Promise<void> {
  if (intent.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error("claim deadline has expired");
  }
  if (intent.windowIds.length === 0) {
    throw new Error("windowIds must not be empty");
  }
  for (const windowId of intent.windowIds) {
    if (windowId <= 0n) {
      throw new Error("invalid windowId: must be positive");
    }
  }

  const computedPoolId = computePoolId(intent.poolKey);
  if (computedPoolId.toLowerCase() !== intent.poolId.toLowerCase()) {
    throw new Error("poolId does not match poolKey");
  }

  const chainNonce = await getClaimNonce(intent.user);
  if (chainNonce !== intent.nonce) {
    throw new Error(`nonce mismatch: expected ${chainNonce.toString()}, got ${intent.nonce.toString()}`);
  }

  const digest = await claimIntentDigest(intent);
  const recovered = await recoverAddress({ hash: digest, signature: intent.signature });
  if (getAddress(recovered) !== getAddress(intent.user)) {
    throw new Error("invalid signature");
  }

  const { v, r, s } = splitSignature(intent.signature);
  await simulateClaimAllFor(intent, { v, r, s });
}

export async function submitClaim(intent: ClaimIntent): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();
  const { v, r, s } = splitSignature(intent.signature);
  const hash = await walletClient.writeContract({
    account: getRelayerAccount(),
    address: getHookAddress(),
    abi: pariHookWriteAbi,
    functionName: "claimAllFor",
    args: [toAbiPoolKey(intent.poolKey), intent.windowIds, intent.user, intent.deadline, v, r, s]
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function getClaimNonce(address: `0x${string}`): Promise<bigint> {
  return getPublicClient().readContract({
    address: getHookAddress(),
    abi: [{
      type: "function",
      name: "claimNonces",
      stateMutability: "view",
      inputs: [{ name: "user", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }] as const,
    functionName: "claimNonces",
    args: [address]
  });
}

async function simulateClaimAllFor(intent: ClaimIntent, signature: SignatureParts): Promise<void> {
  const data = encodeFunctionData({
    abi: pariHookWriteAbi,
    functionName: "claimAllFor",
    args: [toAbiPoolKey(intent.poolKey), intent.windowIds, intent.user, intent.deadline, signature.v, signature.r, signature.s]
  });

  await getPublicClient().call({
    account: getRelayerAccount(),
    to: getHookAddress(),
    data
  });
}

function computePoolId(poolKey: PoolKeyInput): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" }
      ],
      [
        normalizeAddress(poolKey.currency0, "poolKey.currency0"),
        normalizeAddress(poolKey.currency1, "poolKey.currency1"),
        poolKey.fee,
        poolKey.tickSpacing,
        normalizeAddress(poolKey.hooks, "poolKey.hooks")
      ]
    )
  );
}

async function claimIntentDigest(intent: ClaimIntent): Promise<`0x${string}`> {
  const chainId = await getPublicClient().getChainId();
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" }
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        keccak256(stringToHex(EIP712_DOMAIN_NAME)),
        keccak256(stringToHex(EIP712_DOMAIN_VERSION)),
        BigInt(chainId),
        getHookAddress()
      ]
    )
  );

  const windowIdsHash = hashUint256Array(intent.windowIds);
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" }
      ],
      [
        CLAIM_INTENT_TYPEHASH,
        intent.user,
        intent.poolId,
        windowIdsHash,
        intent.nonce,
        intent.deadline
      ]
    )
  );

  return keccak256(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}` as Hex);
}

function hashUint256Array(values: bigint[]): `0x${string}` {
  if (values.length === 0) {
    throw new Error("windowIds must not be empty");
  }
  const packed = `0x${values.map((value) => toHex(value, { size: 32 }).slice(2)).join("")}` as Hex;
  return keccak256(packed);
}

function toAbiPoolKey(poolKey: PoolKeyInput) {
  return {
    currency0: normalizeAddress(poolKey.currency0, "poolKey.currency0"),
    currency1: normalizeAddress(poolKey.currency1, "poolKey.currency1"),
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hooks: normalizeAddress(poolKey.hooks, "poolKey.hooks")
  };
}

function normalizePoolKey(poolKey: PoolKeyInput): PoolKeyInput {
  return {
    currency0: normalizeAddress(poolKey.currency0, "poolKey.currency0"),
    currency1: normalizeAddress(poolKey.currency1, "poolKey.currency1"),
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hooks: normalizeAddress(poolKey.hooks, "poolKey.hooks")
  };
}

function normalizeAddress(value: string, field: string): `0x${string}` {
  if (!isAddress(value)) {
    throw new Error(`${field} must be a valid address`);
  }
  return getAddress(value);
}

function normalizeHex32(value: string, field: string): `0x${string}` {
  const lower = value.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(lower)) {
    throw new Error(`${field} must be 32-byte hex`);
  }
  return lower as `0x${string}`;
}

function normalizeSignature(value: string): `0x${string}` {
  const lower = value.toLowerCase();
  if (!/^0x[0-9a-f]{130}$/.test(lower)) {
    throw new Error("signature must be 65-byte hex");
  }
  return lower as `0x${string}`;
}

function parseBigIntDecimal(value: string, field: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`invalid ${field}`);
  }
}

function splitSignature(signature: `0x${string}`): SignatureParts {
  const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const rawV = Number.parseInt(signature.slice(130, 132), 16);
  const v = rawV >= 27 ? rawV - 27 : rawV;
  return {
    v,
    r: normalizeHex32(r, "signature.r"),
    s: normalizeHex32(s, "signature.s")
  };
}
