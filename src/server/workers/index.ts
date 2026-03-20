import { env } from "@/server/config/env";
import { startPriceRefreshWorker, type PriceRefreshWorkerStatus } from "@/server/workers/priceRefresh";
import { startSettlementWorker, type SettlementWorkerStatus } from "@/server/workers/settlement";
import { startPayoutPushWorker, type PayoutPushWorkerStatus } from "@/server/workers/payouts";
import { startSeedingWorker, type SeedingWorkerStatus } from "@/server/workers/seeding";
import { startBetSettlementWorker, type BetSettlementWorkerStatus } from "@/server/workers/betSettlement";

export type WorkerStatus =
  | PriceRefreshWorkerStatus
  | SettlementWorkerStatus
  | SeedingWorkerStatus
  | PayoutPushWorkerStatus
  | BetSettlementWorkerStatus
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
          { name: "seeding", enabled: false, reason: "ENABLE_INTERNAL_WORKERS=false" },
          { name: "payout-push", enabled: false, reason: "ENABLE_INTERNAL_WORKERS=false" },
          { name: "bet-settlement", enabled: false, reason: "ENABLE_INTERNAL_WORKERS=false" }
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
    workers.push(await startPayoutPushWorker(env.PAYOUT_PUSH_POLL_INTERVAL_MS));

    if (env.BET_SETTLEMENT_WORKER_ENABLED) {
      workers.push(await startBetSettlementWorker(env.BET_SETTLEMENT_POLL_INTERVAL_MS));
    } else {
      workers.push({ name: "bet-settlement", enabled: false, reason: "BET_SETTLEMENT_WORKER_ENABLED=false" });
    }

    return {
      started: true,
      workers
    };
  })();

  return startPromise;
}
