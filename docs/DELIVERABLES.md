# Deliverables

## Phase 1
- Next.js project scaffold
- shared env/config module
- health route
- docs: PRD, plan, tasks, deliverables

## Phase 2
- public landing/terminal routes migrated
- SEO metadata handled in Next.js
- public price route migrated
  - initial Coinbase-backed route handler implemented
- rides and leaderboard REST routes migrated
  - initial Supabase-backed ride metadata routes implemented

## Phase 3
- Privy auth route migration
- backend session cookie migration
  - initial Privy auth and session routes implemented
- onboarding/profile sync migration

## Phase 4
- permit relay migration
- bet relay migration
  - initial bet relay route and permit path implemented
- claim relay migration
- nonce manager parity

## Phase 5
- settlement worker
- seeding worker
- optional payout worker

## Definition of Done
- frontend app served by Next.js
- old Vite client no longer required for primary runtime
- keeper API parity reached for public routes and relay routes
- worker jobs can run from the same application codebase
- deployment docs updated
