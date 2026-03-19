# PRD

## Product

BlocksRide Next Server is the unified application runtime for BlocksRide. It serves the website, terminal experience, public market data, auth/session sync, relay transactions, and admin/operator workflows from one TypeScript codebase.

## Problem

The current system is split across:
- `blocksride/client` (Vite frontend)
- `blocksride-keeper` (Go API + worker logic)

That split increases maintenance overhead, duplicates configuration, complicates deployment, and weakens SEO for public pages.

## Goals

1. Run frontend and backend from one deployable TypeScript application.
2. Keep relayed transaction support for permit, bet, and claim flows.
3. Preserve public market data endpoints and websocket feeds.
4. Preserve admin/operator support for settlement and seeding.
5. Improve SEO and public-site rendering through Next.js.

## Non-Goals

- Rewriting smart contracts
- Changing market logic
- Removing relayer support
- Removing Supabase-backed metadata/cache flows

## Core Capabilities

### Public App
- Landing page
- Demo page
- Terminal page
- Static metadata, sitemap, robots, and social previews

### Public APIs
- `GET /api/public-price`
- `GET /api/rides/active`
- `GET /api/rides/upcoming`
- `GET /api/rides/:rideId/leaderboard`
- public websocket feeds for price and grid updates

### Auth / Session
- Privy token verification
- backend session cookie
- onboarding/profile sync

### Relay
- permit relay
- bet relay
- claim relay
- signer nonce management

### Operator Workflows
- settlement jobs
- seeding jobs
- payout push jobs if still needed

## Constraints

- Keep one codebase and one deployable server target.
- Maintain a clean boundary between request handlers and worker loops.
- Prefer `viem` over duplicated contract wrapper logic.
- Preserve Base Sepolia/Base config paths.
