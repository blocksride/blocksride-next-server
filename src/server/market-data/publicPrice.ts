import { PUBLIC_PRICE_ASSETS, type PublicPriceAssetId } from "@/shared/market";

export type CachedPublicPrice = {
  price: number;
  source: string;
  timestamp: Date;
};

export type PublicPriceResult = {
  assetId: PublicPriceAssetId;
  price: number;
  source: string;
  ts: string;
  stale?: boolean;
};

const cache = new Map<PublicPriceAssetId, CachedPublicPrice>();
const CACHE_TTL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 2_000;

export function isSupportedPublicPriceAsset(assetId: string): assetId is PublicPriceAssetId {
  return assetId in PUBLIC_PRICE_ASSETS;
}

export async function getPublicPrice(assetId: PublicPriceAssetId): Promise<PublicPriceResult> {
  const cached = cache.get(assetId);
  if (cached && Date.now() - cached.timestamp.getTime() <= CACHE_TTL_MS) {
    return serialize(assetId, cached, false);
  }

  try {
    const price = await fetchCoinbaseSpot(PUBLIC_PRICE_ASSETS[assetId]);
    const fresh: CachedPublicPrice = {
      price,
      source: "coinbase",
      timestamp: new Date()
    };
    cache.set(assetId, fresh);
    return serialize(assetId, fresh, false);
  } catch (error) {
    if (cached) {
      return serialize(assetId, { ...cached, source: `${cached.source}-stale` }, true);
    }

    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`failed to fetch public price: ${message}`);
  }
}

async function fetchCoinbaseSpot(productId: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.coinbase.com/v2/prices/${productId}/spot`, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`coinbase returned ${response.status}`);
    }

    const body = (await response.json()) as { data?: { amount?: string } };
    const amount = body.data?.amount;
    if (!amount) {
      throw new Error("coinbase response missing amount");
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) {
      throw new Error("coinbase returned invalid price");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function serialize(assetId: PublicPriceAssetId, entry: CachedPublicPrice, stale: boolean): PublicPriceResult {
  return {
    assetId,
    price: entry.price,
    source: entry.source,
    ts: entry.timestamp.toISOString(),
    ...(stale ? { stale: true } : {})
  };
}
