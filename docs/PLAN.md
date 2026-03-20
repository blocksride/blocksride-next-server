# Plan

## Architecture Decision

Use one Next.js server application as the backend runtime and keep long-running keeper tasks as internal worker modules started through server bootstrap/instrumentation.

The current frontend remains `blocksride/client`. `rides` is the canonical market naming; `contests` exists only as a compatibility alias.

## Sequence

1. Scaffold the TypeScript backend and shared server modules.
2. Migrate read-only/public keeper endpoints first.
3. Migrate auth/session flows.
4. Migrate relay endpoints.
5. Add client-compatibility routes and payload parity fixes.
6. Migrate worker loops.
7. Cut `blocksride/client` over from Go keeper to Next server.

## Route Direction

- keep `rides` as the canonical resource namespace
- keep `contests` only as a temporary alias for the existing frontend
- keep synthetic `grids` reads only while the frontend still depends on them
- do not expose public mutation helpers such as `POST /api/grids/ensure`

## Migration Strategy

### Low-risk first
- read-only/public endpoints
- health
- public price
- ride/leaderboard metadata

### Medium-risk next
- auth/session
- Supabase sync
- client compatibility aliases

### High-risk last
- signed transaction relay
- nonce management
- settlement/seeding automation

## State and Coordination

- Do not use Redis in `blocksride-next-server`.
- Keep ephemeral coordination in-process: seeding jobs, worker in-flight locks, recent price cache, and short-lived relay buffers.
- Put only restart-sensitive or auditable state in Supabase/Postgres.
- Keep market truth on-chain.

## Admin Route Protection

For `/api/admin/seeding/*` and similar routes:
- require backend session auth derived from Privy
- require server-side admin allowlist via `ADMIN_USER_IDS`
- prefer wallet/user allowlists over client-visible flags
- add strict `Origin` validation for admin mutations
- optionally gate high-risk mutations behind a second admin secret header in production
- write audit logs for every admin action
- add basic rate limiting to mutation endpoints


- Next.js route handlers
- TypeScript
- viem
- zod
- Supabase REST
- Privy verification

## Current Actualized Work

- health route implemented
- env schema implemented
- public price route implemented with in-memory cache and Coinbase fallback path
- Supabase-backed ride read routes implemented for active, upcoming, and leaderboard reads
- initial auth/session routes implemented with cookie-based session handling
- relay nonce reads implemented with viem against the deployed hook
- bet relay route implemented with validation, permit-aware scheduling, and on-chain submission
- claim relay route implemented with validation, simulation, and direct relayed submission
- internal price-refresh worker bootstrap implemented
- initial on-chain settlement worker implemented using Hermes + `PariHook.settle(...)`
- initial seeding worker and admin seeding routes implemented
- initial payout-push worker implemented

## Immediate Next Work

- automatic payout pushing is now migrated into the Next worker runtime
- decide whether chat websocket support should be migrated or retired
- add relay hardening for signer nonce management and typed error mapping
