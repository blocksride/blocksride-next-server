# Plan

## Architecture Decision

Use one Next.js application as the main runtime and keep long-running keeper tasks as internal worker modules started by a dedicated bootstrap entrypoint.

## Sequence

1. Scaffold Next.js app and shared server modules.
2. Move public/static concerns first:
   - homepage
   - demo
   - SEO
   - `public-price`
   - rides/leaderboard reads
3. Move auth/session flows.
4. Move relay endpoints.
5. Move worker loops.
6. Cut over traffic from Vite + Go keeper to Next server.

## Migration Strategy

### Low-risk first
- read-only/public endpoints
- metadata and route structure

### Medium-risk next
- auth/session
- Supabase sync

### High-risk last
- signed transaction relay
- nonce management
- settlement/seeding automation

## Technical Stack

- Next.js
- TypeScript
- React
- viem
- zod
- pino
- ws / native WebSocket support as needed
- Supabase REST
- Privy verification

## Current Actualized Work

- health route implemented
- env schema implemented
- public price route implemented with in-memory cache and Coinbase fallback path
- Supabase-backed ride read routes implemented for active, upcoming, and leaderboard reads
- initial auth/session routes implemented with cookie-based session handling
