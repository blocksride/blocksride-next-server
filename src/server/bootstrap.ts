import { startWorkers } from "@/server/workers";

async function main() {
  const result = await startWorkers();
  console.log("worker bootstrap", result);
}

void main();
