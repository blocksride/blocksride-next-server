# Tasks

## Foundation
- [x] Create `blocksride-next-server/` scaffold
- [x] Create migration docs
- [x] Add initial Next.js app structure
- [x] Add health route
- [x] Add package/tooling files
- [x] Add env schema and config loader
- [x] Add shared ABI/constants package area

## Current Backend Compatibility
- [x] Implement `/api/public-price`
- [x] Implement `/api/rides/active`
- [x] Implement `/api/rides/upcoming`
- [x] Implement `/api/rides/[rideId]/leaderboard`
- [x] Implement `POST /api/auth/privy`
- [x] Implement `GET /api/auth/me`
- [x] Implement onboarding complete route
- [x] Implement permit relay flow
- [x] Implement bet relay flow
- [x] Implement claim relay flow
- [x] Implement price refresh/cache loop

## Client Compatibility Gaps
- [x] Add `/api/contests/active` alias
- [x] Add `/api/contests/upcoming` alias
- [x] Add `/api/contests/:contestId/leaderboard` alias
- [x] Add `/api/pools`
- [x] Add `/api/wallet/permit-info`
- [x] Add `/api/users/profile`
- [x] Add `/api/auth/logout`
- [x] Fix `/api/relay/claim` payload compatibility with current client

## State Model
- [x] Remove Redis from the Next server design
- [x] Use in-app state for seeding coordination and worker locks
- [ ] Persist only restart-sensitive admin/job state in Supabase if needed later

## Admin Route Hardening
- [x] Protect admin seeding routes with authenticated admin session checks
- [ ] Add `Origin` validation on admin mutation routes
- [ ] Add optional second-factor admin secret for production mutations
- [ ] Add audit logging for admin seeding actions
- [ ] Add rate limiting for admin mutation routes

## Relay Hardening
- [ ] Implement signer nonce manager
- [ ] Add typed error mapping

## Worker Migration
- [x] Settlement loop
- [x] Seeding loop
- [x] Admin seeding helpers

## Remaining Worker Gaps
- [x] Migrate automatic payout pushing (`pushPayouts`)

## Deferred / Legacy Surfaces
- [x] Add read-only `/api/grids/*` compatibility routes for transition only
- [x] Remove `POST /api/grids/ensure` from the Next server surface
- [x] Add `/api/prices/:assetId` compatibility route
- [ ] Replace no-op `/api/analytics/miniapp` with admin analytics surfaces
- [x] Add minimal practice-only `/api/positions` compatibility route -
- [x] Add `/api/trading-pairs` compatibility route - current pair is ETH-USDC
- [ ] Retire chat websocket support. share telegram group link
