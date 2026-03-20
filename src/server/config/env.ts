import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ENV: z.string().optional(),
  NETWORK: z.enum(["mainnet", "sepolia"]).default("sepolia"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  RPC_URL: z.string().url().optional(),
  PARIHOOK_CONTRACT_ADDRESS: z.string().optional(),
  RELAYER_PRIVATE_KEY: z.string().optional(),
  KEEPER_PRIVATE_KEY: z.string().optional(),
  USDC_TOKEN_ADDRESS: z.string().optional(),
  PYTH_CONTRACT_ADDRESS: z.string().optional(),
  PYTH_HERMES_URL: z.string().url().default("https://hermes.pyth.network"),
  PLATFORM_TREASURY: z.string().optional(),
  KEEPER_POOLS: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ADMIN_USER_IDS: z.string().optional(),
  ENABLE_INTERNAL_WORKERS: z.coerce.boolean().default(false),
  PRICE_REFRESH_ENABLED: z.coerce.boolean().default(true),
  PRICE_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  SETTLEMENT_WORKER_ENABLED: z.coerce.boolean().default(false),
  SETTLEMENT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  SETTLEMENT_LOOKBACK_WINDOWS: z.coerce.number().int().nonnegative().default(5),
  SETTLEMENT_MAX_WINDOWS_PER_TICK: z.coerce.number().int().positive().default(3),
  SEEDING_WORKER_ENABLED: z.coerce.boolean().default(false),
  SEEDING_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  SEEDING_DEFAULT_RANGE: z.coerce.number().int().positive().default(10),
  SEED_AMOUNT_USDC: z.string().default("10000")
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
