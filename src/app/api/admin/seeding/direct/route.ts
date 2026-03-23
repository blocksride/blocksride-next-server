import { NextResponse } from "next/server";
import { getAddress, maxUint256 } from "viem";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/admin";
import { getKeeperWalletClient, getPublicClient } from "@/server/chain/client";
import { getKeeperPools } from "@/server/config/pools";
import { pariHookKeeperAbi } from "@/shared/abi/pariHookKeeper";
import { usdcAbi } from "@/shared/abi/usdc";

export const runtime = "nodejs";

const seedSchema = z.object({
  poolId: z.string(),
  windowId: z.number().int().nonnegative(),
  cells: z.array(z.number().int().nonnegative()).min(1).max(100),
  amountUsdc: z.string().regex(/^\d+$/)
});

export async function POST(request: Request) {
  try {
    requireAdminSession(request);

    const body = seedSchema.parse(await request.json());
    const pool = getKeeperPools().find(
      (p) => p.poolId.toLowerCase() === body.poolId.toLowerCase()
    );
    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 400 });
    }

    const hookAddress = getAddress(pool.poolKey.hooks);
    const publicClient = getPublicClient();
    const walletClient = getKeeperWalletClient();
    const account = walletClient.account;
    if (!account) {
      return NextResponse.json({ error: "Keeper wallet not available" }, { status: 500 });
    }

    const amountUsdc = BigInt(body.amountUsdc);
    const requiredAllowance = amountUsdc * BigInt(body.cells.length);

    const config = await publicClient.readContract({
      address: hookAddress,
      abi: pariHookKeeperAbi,
      functionName: "gridConfigs",
      args: [pool.poolId as `0x${string}`]
    });

    const usdcAddress = getAddress(config[7]);
    const allowance = await publicClient.readContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: "allowance",
      args: [account.address, hookAddress]
    });

    if (allowance < requiredAllowance) {
      const approvalHash = await walletClient.writeContract({
        account,
        address: usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [hookAddress, maxUint256]
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });
    }

    const txHashes: string[] = [];
    for (const cellId of body.cells) {
      const hash = await walletClient.writeContract({
        account,
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "seedWindow",
        args: [pool.poolKey, BigInt(cellId), BigInt(body.windowId), amountUsdc]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      txHashes.push(hash);
    }

    return NextResponse.json({ ok: true, seeded: body.cells.length, txHashes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "seeding failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
