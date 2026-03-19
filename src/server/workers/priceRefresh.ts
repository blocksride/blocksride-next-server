import { PUBLIC_PRICE_ASSETS, type PublicPriceAssetId } from "@/shared/market";
import { getPublicPrice } from "@/server/market-data/publicPrice";

let priceRefreshTimer: NodeJS.Timeout | null = null;

export type PriceRefreshWorkerStatus = {
  name: "price-refresh";
  enabled: boolean;
  intervalMs: number;
  assets: PublicPriceAssetId[];
};

export async function startPriceRefreshWorker(intervalMs: number): Promise<PriceRefreshWorkerStatus> {
  const assets = Object.keys(PUBLIC_PRICE_ASSETS) as PublicPriceAssetId[];

  if (priceRefreshTimer) {
    return {
      name: "price-refresh",
      enabled: true,
      intervalMs,
      assets
    };
  }

  await refreshAllPublicPrices(assets);

  priceRefreshTimer = setInterval(() => {
    void refreshAllPublicPrices(assets);
  }, intervalMs);

  return {
    name: "price-refresh",
    enabled: true,
    intervalMs,
    assets
  };
}

async function refreshAllPublicPrices(assets: PublicPriceAssetId[]): Promise<void> {
  await Promise.all(
    assets.map(async (assetId) => {
      try {
        await getPublicPrice(assetId);
      } catch (error) {
        console.error(`[workers] price refresh failed for ${assetId}`, error);
      }
    })
  );
}
