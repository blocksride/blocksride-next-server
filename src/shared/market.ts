export const PUBLIC_PRICE_ASSETS = {
  "ETH-USD": "ETH-USD",
  "BTC-USD": "BTC-USD"
} as const;

export type PublicPriceAssetId = keyof typeof PUBLIC_PRICE_ASSETS;
