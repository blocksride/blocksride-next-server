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

## Relay Hardening
- [ ] Implement signer nonce manager
- [ ] Add typed error mapping

## Worker Migration
- [ ] Settlement loop
- [ ] Seeding loop
- [ ] Admin seeding helpers

## Deferred / Legacy Surfaces
- [x] Add synthetic `/api/grids/*` compatibility routes
- [x] Add `/api/prices/:assetId` compatibility route
- [x] Add no-op `/api/analytics/miniapp` compatibility route
- [x] Add minimal practice-only `/api/positions` compatibility route
- [x] Add `/api/trading-pairs` compatibility route
- [ ] Decide whether to keep or retire chat websocket support
