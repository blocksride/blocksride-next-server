export type SeedingConfig = {
  pending: number[];
  range: number;
  poolId?: `0x${string}`;
  assetId?: string;
};

let activeConfig: SeedingConfig | null = null;
const seededWindows = new Set<string>();

export function armSeeding(config: SeedingConfig): SeedingConfig {
  activeConfig = {
    pending: [...config.pending],
    range: config.range,
    ...(config.poolId ? { poolId: config.poolId } : {}),
    ...(config.assetId ? { assetId: config.assetId } : {})
  };
  return activeConfig;
}

export function disarmSeeding(): void {
  activeConfig = null;
}

export function getSeedingStatus() {
  if (!activeConfig || activeConfig.pending.length === 0) {
    return { armed: false, pending: [] as number[], range: 0 };
  }

  return {
    armed: true,
    pending: [...activeConfig.pending],
    range: activeConfig.range,
    ...(activeConfig.poolId ? { poolId: activeConfig.poolId } : {}),
    ...(activeConfig.assetId ? { assetId: activeConfig.assetId } : {})
  };
}

export function getNextSeedTask(): SeedingConfig | null {
  if (!activeConfig || activeConfig.pending.length === 0) {
    return null;
  }
  return {
    pending: [...activeConfig.pending],
    range: activeConfig.range,
    ...(activeConfig.poolId ? { poolId: activeConfig.poolId } : {}),
    ...(activeConfig.assetId ? { assetId: activeConfig.assetId } : {})
  };
}

export function markWindowSeeded(windowId: number): void {
  if (!activeConfig) {
    return;
  }
  activeConfig.pending = activeConfig.pending.filter((value) => value !== windowId);
  if (activeConfig.pending.length === 0) {
    activeConfig = null;
  }
}

export function wasWindowSeeded(key: string): boolean {
  return seededWindows.has(key);
}

export function markSeededKey(key: string): void {
  seededWindows.add(key);
}
