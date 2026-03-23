import type { Hex } from "viem";

import { env } from "@/server/config/env";

export async function fetchPythVaa(feedId: string, timestamp: number): Promise<Hex> {
  const url = new URL(`${env.PYTH_HERMES_URL}/v2/updates/price/${timestamp}`);
  url.searchParams.append("ids[]", feedId);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Pyth Hermes request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { binary?: { data?: string[] } };
  const vaaHex = payload.binary?.data?.[0];
  if (!vaaHex) {
    throw new Error("No VAA returned from Pyth Hermes");
  }

  return `0x${vaaHex}` as Hex;
}
