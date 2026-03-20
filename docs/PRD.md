# PRD

## Product

BlocksRide Next Server is the unified TypeScript backend runtime for BlocksRide. It serves the API, auth/session handling, relay transactions, public market data, and internal worker jobs consumed by the existing `blocksride/client` frontend.

## Problem

The current system is split across:
- `blocksride/client` (Vite frontend)
- `blocksride-keeper` (Go API + worker logic)

The Go keeper is the main replacement target. We do not need to duplicate the current frontend while this migration is in progress.

## Goals

1. Replace `blocksride-keeper` with one deployable TypeScript server.
2. Keep `blocksride/client` working against the new backend with minimal frontend churn.
3. Preserve relayed transaction support for permit, bet, and claim flows.
4. Preserve public market data endpoints used by the existing client.
5. Preserve admin/operator support for settlement and seeding.
6. Allow internal worker loops to run in the same server process when enabled.

## Non-Goals

- Rewriting smart contracts
- Changing market logic
- Replacing `blocksride/client` right now
- Building a second parallel frontend in this repo
- Removing relayer support
- Removing Supabase-backed metadata/cache flows

## Core Capabilities

### Client Compatibility APIs
- auth/session endpoints used by `blocksride/client`
- relay endpoints used by `blocksride/client`
- public price endpoints used by `blocksride/client`
- contest/ride metadata endpoints used by `blocksride/client`
- pools and wallet metadata endpoints required for permit/bet flow

### Relay
- permit relay
- bet relay
- claim relay
- signer nonce reads and later signer nonce management

### Operator Workflows
- settlement jobs
- seeding jobs
- price refresh jobs

## Constraints

- Keep one backend codebase and one deployable server target.
- Maintain API compatibility with the current frontend before attempting a frontend migration.
- Prefer route aliases over frontend breakage where endpoint naming differs (`contests` vs `rides`).
- Keep a clean boundary between request handlers and worker loops.
- Prefer `viem` over duplicated contract wrapper logic.
- Preserve Base Sepolia/Base config paths.

## Remaining Non-Core Gap

- chat websocket support remains the only known frontend-facing compatibility gap
