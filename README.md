# BlocksRide Next Server

Single TypeScript codebase for the BlocksRide web app, relay API, public market data, and internal worker jobs.

## Goal

Replace the split `blocksride` + `blocksride-keeper` runtime with one Next.js-based server application plus in-process worker modules.

## Initial Scope

- Next.js app router frontend
- Route handlers for auth, relay, rides, leaderboard, and public price data
- Shared server modules for viem, Supabase, Privy, and relay logic
- Worker entrypoints for settlement, seeding, and price refresh jobs

## Status

This folder is the migration target and planning workspace. The first scaffold is in place; implementation parity with the existing Go keeper is not complete yet.

## Planned Structure

- `src/app/` — Next.js UI and route handlers
- `src/server/` — server-only modules for relay, auth, market data, Supabase, and workers
- `src/shared/` — shared types and constants
- `docs/` — migration docs, PRD, plan, tasks, deliverables

## Implemented Now

- `GET /api/health`
- `GET /api/public-price?asset_id=ETH-USD` with Coinbase-backed fetch and short in-memory cache
- `GET /api/rides/active`, `GET /api/rides/upcoming`, and `GET /api/rides/[rideId]/leaderboard` backed by Supabase REST
- `POST /api/auth/privy`, `GET /api/auth/me`, and `POST /api/auth/onboarding/complete` with cookie-based session handling
- `GET /api/relay/bet-nonce` and `GET /api/relay/claim-nonce` backed by viem contract reads
- `POST /api/relay/bet` with request parsing, EIP-712 validation, allowance checks, permit support, and delayed submission scheduling
- `DELETE /api/relay/bet/[intentId]` for undo-window cancellation
- `POST /api/relay/claim` with EIP-712 claim validation, simulation, and immediate relayed submission
