export type PriceSnapshot = {
  asset_id: string;
  timestamp: string;
  price: number;
  source: string;
  weight: number;
};

const REQUEST_TIMEOUT_MS = 4_000;

export async function getPriceHistory(assetId: string, start?: string | null, end?: string | null): Promise<PriceSnapshot[]> {
  const endTime = end ? new Date(end) : new Date();
  const startTime = start ? new Date(start) : new Date(endTime.getTime() - 10 * 60 * 1000);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new Error("Invalid start or end time");
  }

  const candles = await fetchCoinbaseCandles(assetId, startTime, endTime);
  return candles.map((candle) => ({
    asset_id: assetId,
    timestamp: new Date(candle.time * 1000).toISOString(),
    price: candle.close,
    source: "coinbase",
    weight: 1
  }));
}

type CoinbaseCandle = {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
};

async function fetchCoinbaseCandles(assetId: string, start: Date, end: Date): Promise<CoinbaseCandle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      granularity: "60"
    });

    const response = await fetch(`https://api.exchange.coinbase.com/products/${assetId}/candles?${params.toString()}`, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`coinbase candles returned ${response.status}`);
    }

    const raw = (await response.json()) as Array<[number, number, number, number, number, number]>;
    return raw
      .map(([time, low, high, open, close, volume]) => ({ time, low, high, open, close, volume }))
      .sort((a, b) => a.time - b.time);
  } finally {
    clearTimeout(timeout);
  }
}
