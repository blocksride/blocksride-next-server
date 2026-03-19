import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ENV: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  RPC_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ADMIN_USER_IDS: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
