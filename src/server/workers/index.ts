import { env } from "@/server/config/env";
import { startPriceRefreshWorker, type PriceRefreshWorkerStatus } from "@/server/workers/priceRefresh";
import { startSettlementWorker, type SettlementWorkerStatus } from "@/server/workers/settlement";
import { startSeedingWorker, type SeedingWorkerStatus } from "@/server/workers/seeding";

export type WorkerStatus =
  | PriceRefreshWorkerStatus
  | SettlementWorkerStatus
  | SeedingWorkerStatus
  | { name: "price-refresh"; enabled: false; reason: string };

let startPromise: Promise<{ started: boolean; workers: WorkerStatus[] }> | null = null;

export async function startWorkers() {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    if (!env.ENABLE_INTERNAL_WORKERS) {
      return {
        started: false,
        workers: [
          { name: "price-refresh", enabled: false, reason: "ENABLE_INTERNAL_WORKERS=false" },
          { name: "settlement", enabled: false, reason: "ENABLE_INTERNAL_WORKERS=false" },
          { name: "seeding", enabled: false, reason: "ENABLE_INTERNAL_WORKERS=false" }
        ] satisfies WorkerStatus[]
      };
    }

    const workers: WorkerStatus[] = [];

    if (env.PRICE_REFRESH_ENABLED) {
      workers.push(await startPriceRefreshWorker(env.PRICE_REFRESH_INTERVAL_MS));
    } else {
      workers.push({ name: "price-refresh", enabled: false, reason: "PRICE_REFRESH_ENABLED=false" });
    }

    workers.push(await startSettlementWorker(env.SETTLEMENT_POLL_INTERVAL_MS));
    workers.push(await startSeedingWorker(env.SEEDING_POLL_INTERVAL_MS));

    return {
      started: true,
      workers
    };
  })();

  return startPromise;
}
