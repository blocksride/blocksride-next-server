import { z } from "zod";

export const poolKeySchema = z.object({
  currency0: z.string(),
  currency1: z.string(),
  fee: z.number().int().nonnegative(),
  tickSpacing: z.number().int(),
  hooks: z.string()
});

export const placeBetRequestSchema = z.object({
  poolId: z.string(),
  poolKey: poolKeySchema,
  cellId: z.string(),
  windowId: z.string(),
  amount: z.string(),
  nonce: z.string(),
  deadline: z.string(),
  signature: z.string(),
  signer: z.string(),
  submitAfterMs: z.number().int().positive().max(30_000).optional(),
  permitAmount: z.string().optional(),
  permitDeadline: z.string().optional(),
  permitV: z.number().int().optional(),
  permitR: z.string().optional(),
  permitS: z.string().optional()
});

export type PlaceBetRequest = z.infer<typeof placeBetRequestSchema>;

export type PoolKeyInput = z.infer<typeof poolKeySchema>;

export type PermitIntent = {
  spender: `0x${string}`;
  value: bigint;
  deadline: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
};

export type BetIntent = {
  poolId: `0x${string}`;
  poolKey: PoolKeyInput;
  cellId: bigint;
  windowId: bigint;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  signer: `0x${string}`;
  signature: `0x${string}`;
  permit?: PermitIntent;
};
