# BlocksRide Next Server

Single TypeScript backend and worker runtime for the existing `blocksride/client` frontend.

## Goal

Replace `blocksride-keeper` with one Next.js-based server application that serves the API, relay flows, public market data, and internal worker jobs used by `blocksride/client`.

## Important Boundary

`blocksride/client` stays independent.

This project is not a second frontend and should not duplicate the Vite app unless there is an explicit later decision to migrate the UI. Right now the job of `blocksride-next-server` is backend compatibility and operational replacement for the Go keeper.

## Scope

- Route handlers for auth, relay, contests/rides, leaderboard, pools, wallet metadata, and public price data
- Shared server modules for viem, Supabase, Privy, and relay logic
- Internal worker modules for settlement, seeding, payout pushing, and price refresh jobs
- Compatibility with the current request surface used by `blocksride/client`
- Next instrumentation hook to start internal workers in the same server process when enabled

## Status

This folder is the backend migration target and planning workspace. Core API compatibility for the current client is largely in place; the main remaining frontend-facing gap is chat websocket support, and the main backend gap is relay hardening.

## Planned Structure

- `src/app/api/` — Next route handlers only
- `src/server/` — server-only modules for relay, auth, market data, Supabase, and workers
- `src/shared/` — shared types and constants
- `docs/` — migration docs, PRD, plan, tasks, deliverables

## Implemented Now

- `GET /api/health`
- `GET /api/public-price?asset_id=ETH-USD` with Coinbase-backed fetch and short in-memory cache
- `GET /api/rides/active`, `GET /api/rides/upcoming`, `GET /api/rides/[rideId]/leaderboard`, and matching `/api/contests/*` aliases backed by Supabase REST
- `POST /api/auth/privy`, `GET /api/auth/me`, `POST /api/auth/onboarding/complete`, `POST /api/users/profile`, and `POST /api/auth/logout` with cookie-based session handling
- `GET /api/relay/bet-nonce`, `GET /api/relay/claim-nonce`, `GET /api/pools`, and `GET /api/wallet/permit-info` backed by viem/env config
- `POST /api/relay/bet` with request parsing, EIP-712 validation, allowance checks, permit support, and delayed submission scheduling
- `DELETE /api/relay/bet/[intentId]` for undo-window cancellation
- `POST /api/relay/claim` with EIP-712 claim validation, simulation, and immediate relayed submission
- Internal price-refresh worker bootstrap via `src/instrumentation.ts` and `src/server/workers/priceRefresh.ts`
- Initial on-chain settlement worker using Hermes + `PariHook.settle(...)` via `src/server/workers/settlement.ts`
- Initial seeding worker plus admin seeding routes via `src/server/workers/seeding.ts` and `/api/admin/seeding/*`
- Initial payout-push worker via `src/server/workers/payouts.ts` to batch `pushPayouts(...)` calls for settled winning windows
- Compatibility routes for `contests`, `pools`, `wallet/permit-info`, `users/profile`, `auth/logout`, `grids`, `prices`, `positions`, `leaderboard`, `trading-pairs`, and `user/stats`

## Current Compatibility Gaps

Frontend-facing compatibility is mostly covered.

Remaining gaps:
- chat websocket support (`/api/chat/ws`) if the existing chat UI is still meant to be kept
- relay hardening around signer nonce management and typed error mapping
