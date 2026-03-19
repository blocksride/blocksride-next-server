import { env } from "@/server/config/env";
import { startPriceRefreshWorker, type PriceRefreshWorkerStatus } from "@/server/workers/priceRefresh";

export type WorkerStatus =
  | PriceRefreshWorkerStatus
  | { name: "price-refresh"; enabled: false; reason: string }
  | { name: "settlement"; enabled: false; reason: string }
  | { name: "seeding"; enabled: false; reason: string };

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
          { name: "settlement", enabled: false, reason: "not migrated yet" },
          { name: "seeding", enabled: false, reason: "not migrated yet" }
        ] satisfies WorkerStatus[]
      };
    }

    const workers: WorkerStatus[] = [];

    if (env.PRICE_REFRESH_ENABLED) {
      workers.push(await startPriceRefreshWorker(env.PRICE_REFRESH_INTERVAL_MS));
    } else {
      workers.push({ name: "price-refresh", enabled: false, reason: "PRICE_REFRESH_ENABLED=false" });
    }

    workers.push({ name: "settlement", enabled: false, reason: "not migrated yet" });
    workers.push({ name: "seeding", enabled: false, reason: "not migrated yet" });

    return {
      started: true,
      workers
    };
  })();

  return startPromise;
}
