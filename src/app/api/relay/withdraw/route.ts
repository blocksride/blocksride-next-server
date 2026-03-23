import { NextResponse } from "next/server";
import { getAddress, isAddress, hexToNumber, slice, type Hex } from "viem";
import { z } from "zod";

import { env } from "@/server/config/env";
import { getPublicClient, getRelayerAccount, getWalletClient } from "@/server/chain/client";
import { usdcAbi } from "@/shared/abi/usdc";

export const runtime = "nodejs";

const WITHDRAWAL_FEE = BigInt(Math.round(env.WITHDRAWAL_FEE_USDC * 1_000_000));

const schema = z.object({
  from:        z.string().refine(isAddress, "invalid from address"),
  to:          z.string().refine(isAddress, "invalid to address"),
  amount:      z.string().regex(/^\d+$/, "amount must be numeric string (raw USDC units)"),
  validAfter:  z.number().int().nonnegative(),
  validBefore: z.number().int().positive(),
  nonce:       z.string().regex(/^0x[0-9a-fA-F]{64}$/, "nonce must be 32-byte hex"),
  v:           z.number().int().min(27).max(28),
  r:           z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  s:           z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const amount = BigInt(body.amount);

    if (amount <= WITHDRAWAL_FEE) {
      return NextResponse.json(
        { error: `Amount must be greater than fee ($${Number(WITHDRAWAL_FEE) / 1_000_000} USDC)` },
        { status: 400 }
      );
    }

    const treasury = env.PLATFORM_TREASURY;
    if (!treasury || !isAddress(treasury)) {
      return NextResponse.json({ error: "treasury not configured" }, { status: 500 });
    }

    const usdcAddress = getAddress(
      env.USDC_TOKEN_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    );
    const publicClient = getPublicClient();
    const walletClient = getWalletClient();
    const relayer = getRelayerAccount();

    // Step 1: pull full amount from user → relayer via EIP-3009
    const pullHash = await walletClient.writeContract({
      account: relayer,
      address: usdcAddress,
      abi: usdcAbi,
      functionName: "transferWithAuthorization",
      args: [
        getAddress(body.from),
        relayer.address,
        amount,
        BigInt(body.validAfter),
        BigInt(body.validBefore),
        body.nonce as Hex,
        body.v,
        body.r as Hex,
        body.s as Hex,
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: pullHash });

    // Step 2: forward (amount - fee) to destination
    const sendHash = await walletClient.writeContract({
      account: relayer,
      address: usdcAddress,
      abi: usdcAbi,
      functionName: "transfer",
      args: [getAddress(body.to), amount - WITHDRAWAL_FEE],
    });
    await publicClient.waitForTransactionReceipt({ hash: sendHash });

    // Step 3: forward fee to treasury
    const feeHash = await walletClient.writeContract({
      account: relayer,
      address: usdcAddress,
      abi: usdcAbi,
      functionName: "transfer",
      args: [getAddress(treasury), WITHDRAWAL_FEE],
    });
    await publicClient.waitForTransactionReceipt({ hash: feeHash });

    return NextResponse.json({
      success: true,
      amountSent: (amount - WITHDRAWAL_FEE).toString(),
      fee: WITHDRAWAL_FEE.toString(),
      txHash: sendHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "withdrawal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
