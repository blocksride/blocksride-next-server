export async function startWorkers() {
  // TODO: migrate settlement, seeding, and price refresh loops from blocksride-keeper.
  return { started: true, workers: ["settlement", "seeding", "price-refresh"] };
}
