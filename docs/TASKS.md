# Tasks

## Now
- [x] Create `blocksride-next-server/` scaffold
- [x] Create migration docs
- [x] Add initial Next.js app structure
- [x] Add health route
- [x] Add package/tooling files
- [x] Add env schema and config loader
- [x] Add shared ABI/constants package area (placeholder scaffold)

## Public App Migration
- [ ] Port landing page
- [ ] Port terminal shell
- [ ] Port demo page
- [ ] Add route-level metadata
- [ ] Add sitemap/robots generation

## Public API Migration
- [x] Implement `/api/public-price`
- [x] Implement `/api/rides/active`
- [x] Implement `/api/rides/upcoming`
- [x] Implement `/api/rides/[rideId]/leaderboard`
- [ ] Implement public ws feed strategy

## Auth Migration
- [x] Implement `POST /api/auth/privy`
- [x] Implement `GET /api/auth/me`
- [x] Implement onboarding complete route
- [ ] Implement profile sync route

## Relay Migration
- [x] Implement permit relay flow
- [x] Implement bet relay flow
- [x] Implement claim relay flow
- [ ] Implement signer nonce manager
- [ ] Add typed error mapping

## Worker Migration
- [ ] Settlement loop
- [ ] Seeding loop
- [ ] Price refresh/cache loop
- [ ] Admin seeding helpers
