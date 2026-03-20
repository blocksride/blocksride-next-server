# Migration Steps

## Source Systems

### Current frontend source
- `blocksride/client`

### Current backend/worker source
- `blocksride-keeper`

## Boundary

`blocksride/client` remains the active frontend.

This migration is about replacing the Go keeper behind that frontend. Do not port pages/components into this repo unless there is a separate explicit decision to migrate the UI.

## Mapping

### Keeper API
- Go handlers -> Next route handlers under `src/app/api/*`
- Go services -> `src/server/*` modules

### Worker logic
- Go keeper loops -> `src/server/workers/*`

### Client compatibility layer
- preserve the request shapes currently used by `blocksride/client`
- add aliases where naming differs (`contests` vs `rides`)
- avoid unnecessary frontend changes until backend parity exists

## Actualized So Far

- public price route migrated
- ride metadata and leaderboard read routes migrated
- initial Privy auth/session routes migrated
- relay nonce read routes migrated
- bet relay scheduling and submission flow migrated
- claim relay submission flow migrated
- internal price-refresh worker migrated
- initial Hermes-backed settlement worker migrated
- initial in-memory seeding/admin worker flow migrated
- automatic payout-push worker migrated

## Next Required Steps

- payout pushing has been migrated into the Next worker runtime
- review whether chat websocket support should be migrated or retired
- harden relay + worker error handling and nonce policy
