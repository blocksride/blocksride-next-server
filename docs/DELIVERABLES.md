# Deliverables

## Phase 1
- Next.js backend scaffold
- shared env/config module
- health route
- docs: PRD, plan, tasks, deliverables

## Phase 2
- public price route migrated
- ride metadata and leaderboard routes migrated
- auth/session baseline migrated

## Phase 3
- permit relay migration
- bet relay migration
- claim relay migration
- nonce read parity

## Phase 4
- client compatibility layer for the existing Vite frontend
- `contests` aliases
- `pools` route
- `wallet/permit-info` route
- `users/profile` route
- `auth/logout` route
- claim payload parity

## Phase 5
- price refresh worker
- settlement worker
- seeding worker
- admin seeding helpers

## Definition of Done
- `blocksride/client` runs against `blocksride-next-server`
- `blocksride-keeper` is no longer needed for primary local/prod runtime
- relay flows work through the Next server
- public price and metadata reads work through the Next server
- worker jobs can run from the same application codebase
- no duplicate frontend migration is required to reach keeper replacement parity

## Worker Deliverables

- Settlement worker polls configured pools, detects unsettled closed windows, fetches Hermes price updates, and submits `PariHook.settle(...)` transactions when enabled.

- Seeding worker can process admin-armed windows, center keeper bets around the live price, and expose arm/disarm/status routes under `/api/admin/seeding/*`.
