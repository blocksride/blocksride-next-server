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
