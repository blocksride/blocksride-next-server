import { randomUUID } from "node:crypto";

import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  recoverAddress,
  stringToHex,
  type Hex
} from "viem";

import type { BetIntent, PermitIntent, PlaceBetRequest, PoolKeyInput } from "@/shared/relay";
import { placeBetRequestSchema } from "@/shared/relay";
import { env } from "@/server/config/env";
import { getPublicClient, getRelayerAccount, getWalletClient } from "@/server/chain/client";
import { usdcAbi } from "@/shared/abi/usdc";
import { pariHookWriteAbi } from "@/shared/abi/pariHookWrite";

const EIP712_DOMAIN_NAME = "PariHook";
const EIP712_DOMAIN_VERSION = "1";
const EIP712_DOMAIN_TYPEHASH = keccak256(
  stringToHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
);
const BET_INTENT_TYPEHASH = keccak256(
  stringToHex("BetIntent(address user,bytes32 poolId,uint256 cellId,uint256 windowId,uint256 amount,uint256 nonce,uint256 deadline)")
);

type PendingBet = {
  intentId: string;
  intent: BetIntent;
  submitAfter: number;
  timeout: ReturnType<typeof setTimeout>;
};

const pendingBets = new Map<string, PendingBet>();

function getHookAddress(): `0x${string}` {
  const address = env.PARIHOOK_CONTRACT_ADDRESS;
  if (!address || !isAddress(address)) {
    throw new Error("PARIHOOK_CONTRACT_ADDRESS is required and must be a valid address");
  }
  return getAddress(address);
}

function getUsdcAddress(): `0x${string}` {
  const address = env.USDC_TOKEN_ADDRESS;
  if (!address || !isAddress(address)) {
    throw new Error("USDC_TOKEN_ADDRESS is required and must be a valid address");
  }
  return getAddress(address);
}

export function parsePlaceBetRequest(payload: unknown): PlaceBetRequest {
  return placeBetRequestSchema.parse(payload);
}

export function buildBetIntent(request: PlaceBetRequest): BetIntent {
  const poolId = normalizeHex32(request.poolId, "poolId");
  const signer = normalizeAddress(request.signer, "signer");
  const poolKey = normalizePoolKey(request.poolKey);
  const signature = normalizeSignature(request.signature);
  const intent: BetIntent = {
    poolId,
    poolKey,
    cellId: parseBigIntDecimal(request.cellId, "cellId"),
    windowId: parseBigIntDecimal(request.windowId, "windowId"),
    amount: parseBigIntDecimal(request.amount, "amount"),
    nonce: parseBigIntDecimal(request.nonce, "nonce"),
    deadline: parseBigIntDecimal(request.deadline, "deadline"),
    signer,
    signature
  };

  if (request.permitAmount || request.permitDeadline || request.permitV !== undefined || request.permitR || request.permitS) {
    intent.permit = buildPermitIntent(request, poolKey.hooks as `0x${string}`);
  }

  return intent;
}

function buildPermitIntent(request: PlaceBetRequest, spender: `0x${string}`): PermitIntent {
  if (!request.permitAmount || !request.permitDeadline || request.permitV === undefined || !request.permitR || !request.permitS) {
    throw new Error("incomplete permit payload");
  }
  return {
    spender,
    value: parseBigIntDecimal(request.permitAmount, "permitAmount"),
    deadline: parseBigIntDecimal(request.permitDeadline, "permitDeadline"),
    v: request.permitV,
    r: normalizeHex32(request.permitR, "permitR"),
    s: normalizeHex32(request.permitS, "permitS")
  };
}

export async function validateBetIntent(intent: BetIntent): Promise<void> {
  if (intent.amount <= 0n) {
    throw new Error("amount must be positive");
  }
  if (intent.windowId <= 0n) {
    throw new Error("invalid windowId: must be positive");
  }
  if (intent.cellId < 0n) {
    throw new Error("invalid cellId: must be non-negative");
  }
  if (intent.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error("intent deadline has expired");
  }

  const computedPoolId = computePoolId(intent.poolKey);
  if (computedPoolId.toLowerCase() !== intent.poolId.toLowerCase()) {
    throw new Error("poolId does not match poolKey");
  }

  const chainNonce = await getBetNonce(intent.signer);
  if (chainNonce !== intent.nonce) {
    throw new Error(`nonce mismatch: expected ${chainNonce.toString()}, got ${intent.nonce.toString()}`);
  }

  const digest = await betIntentDigest(intent);
  const recovered = await recoverAddress({ hash: digest, signature: intent.signature });
  if (getAddress(recovered) !== getAddress(intent.signer)) {
    throw new Error("invalid signature");
  }

  const allowance = await getUserAllowanceForSpender(intent.signer, getHookAddress());
  const requiresPermit = allowance < intent.amount;
  if (requiresPermit) {
    if (!intent.permit) {
      throw new Error("insufficient hook allowance and no permit provided");
    }
    if (getAddress(intent.permit.spender) !== getHookAddress()) {
      throw new Error("permit spender mismatch");
    }
    if (intent.permit.value < intent.amount) {
      throw new Error("permit amount is below bet amount");
    }
    if (intent.permit.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
      throw new Error("permit deadline has expired");
    }
    return;
  }

  await simulateBetWithSig(intent);
}

export async function scheduleBet(intent: BetIntent, submitAfterMs = 3000): Promise<{ intentId: string; submitAfter: number }> {
  const intentId = randomUUID();
  const submitAfter = Date.now() + submitAfterMs;
  const timeout = setTimeout(async () => {
    const pending = pendingBets.get(intentId);
    if (!pending) {
      return;
    }
    pendingBets.delete(intentId);
    try {
      await submitBet(pending.intent);
    } catch (error) {
      console.error("[relay] bet submission failed", error);
    }
  }, submitAfterMs);

  pendingBets.set(intentId, { intentId, intent, submitAfter, timeout });
  return { intentId, submitAfter: Math.floor(submitAfter / 1000) };
}

export function cancelBet(intentId: string): void {
  const pending = pendingBets.get(intentId);
  if (!pending) {
    throw new Error("intent not found or already submitted");
  }
  clearTimeout(pending.timeout);
  pendingBets.delete(intentId);
}

export async function getBetNonce(address: `0x${string}`): Promise<bigint> {
  return getPublicClient().readContract({
    address: getHookAddress(),
    abi: [{
      type: "function",
      name: "betNonces",
      stateMutability: "view",
      inputs: [{ name: "user", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }] as const,
    functionName: "betNonces",
    args: [address]
  });
}

async function getUserAllowanceForSpender(owner: `0x${string}`, spender: `0x${string}`): Promise<bigint> {
  return getPublicClient().readContract({
    address: getUsdcAddress(),
    abi: usdcAbi,
    functionName: "allowance",
    args: [owner, spender]
  });
}

async function simulateBetWithSig(intent: BetIntent): Promise<void> {
  const callData = encodeFunctionData({
    abi: pariHookWriteAbi,
    functionName: "placeBetWithSig",
    args: [toAbiPoolKey(intent.poolKey), intent.cellId, intent.windowId, intent.amount, intent.signer, intent.nonce, intent.deadline, intent.signature]
  });
  await getPublicClient().call({
    account: getRelayerAccount(),
    to: getHookAddress(),
    data: callData
  });
}

async function submitBet(intent: BetIntent): Promise<void> {
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();
  const account = getRelayerAccount();
  const hookAddress = getHookAddress();
  const allowance = await getUserAllowanceForSpender(intent.signer, hookAddress);

  if (allowance < intent.amount) {
    if (!intent.permit) {
      throw new Error("hook allowance is insufficient and no permit was provided");
    }

    const permitHash = await walletClient.writeContract({
      account,
      address: getUsdcAddress(),
      abi: usdcAbi,
      functionName: "permit",
      args: [intent.signer, hookAddress, intent.permit.value, intent.permit.deadline, intent.permit.v, intent.permit.r, intent.permit.s]
    });
    await publicClient.waitForTransactionReceipt({ hash: permitHash });
  }

  const betHash = await walletClient.writeContract({
    account,
    address: hookAddress,
    abi: pariHookWriteAbi,
    functionName: "placeBetWithSig",
    args: [toAbiPoolKey(intent.poolKey), intent.cellId, intent.windowId, intent.amount, intent.signer, intent.nonce, intent.deadline, intent.signature]
  });
  await publicClient.waitForTransactionReceipt({ hash: betHash });
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

async function betIntentDigest(intent: BetIntent): Promise<`0x${string}`> {
  const publicClient = getPublicClient();
  const chainId = await publicClient.getChainId();
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

  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" }
      ],
      [
        BET_INTENT_TYPEHASH,
        intent.signer,
        intent.poolId,
        intent.cellId,
        intent.windowId,
        intent.amount,
        intent.nonce,
        intent.deadline
      ]
    )
  );

  return keccak256(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}` as Hex);
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
