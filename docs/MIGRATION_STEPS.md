# Migration Steps

## Source Systems

### Current frontend source
- `blocksride/client`

### Current backend/worker source
- `blocksride-keeper`

## Mapping

### Frontend
- Vite pages/components -> Next.js app routes and components

### Keeper API
- Go handlers -> Next route handlers
- Go services -> `src/server/*` modules

### Worker logic
- Go keeper loops -> `src/server/workers/*`

## First Actualization Step

Start the new codebase with a minimal but real runtime:
- root package/tooling
- Next app shell
- health route
- server config module
- worker bootstrap placeholder

That gives a live target to iterate on rather than docs only.

## Actualized So Far

- public price route migrated
- ride metadata and leaderboard read routes migrated
- initial Privy auth/session routes migrated
