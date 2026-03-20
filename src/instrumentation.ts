import { startWorkers } from "@/server/workers";

let bootstrapped = false;

export async function register() {
  if (bootstrapped || process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  bootstrapped = true;
  void startWorkers()
    .then((result) => {
      console.log("[instrumentation] worker startup", result);
    })
    .catch((error) => {
      console.error("[instrumentation] worker startup failed", error);
    });
}
