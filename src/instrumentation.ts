import { startWorkers } from "@/server/workers";

let bootstrapped = false;

export async function register() {
  if (bootstrapped || process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  bootstrapped = true;
  const result = await startWorkers();
  console.log("[instrumentation] worker startup", result);
}
