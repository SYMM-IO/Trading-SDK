---
"@symmio/trading-core": minor
---

Read the inventory lock on listing markets — `isLocked` on every catalogue row, `isLocked` + `lockReasons` on the detail — and regenerate the listing wire types.

The listing backend now reports whether the inventory service has locked a market's pool. A lock pauses **deposits only**: trading, withdrawals and claims stay available, and the lock is orthogonal to `marketStatus` — a `LISTED` market can be locked, and the lock lifts without the lifecycle status moving. The SDK read nothing of this, so a UI could not gate its deposit flow.

**`@symmio/trading-core`**

- New `MarketLockReason` enum: `LIQUIDITY_EXPOSURE`, `LOW_TVL`, `PRICE_UNAVAILABLE`, `SHORT_CIRCUIT`, `MANUAL`, `UNKNOWN`. A reason this release does not recognize is folded to `UNKNOWN` by the mapper rather than thrown, so a newer backend cannot break the read. `UNKNOWN` is still a lock.
- `ListingMarket` (and therefore `UserListingMarket`) gains `isLocked: boolean`. The row carries only the flag; the reasons are on the detail.
- `ListingMarketDetail` gains `isLocked: boolean` and `lockReasons: MarketLockReason[]`. `isLocked` is `false` and `lockReasons` empty when the backend reports no lock state, as it does for a delisted pool. `marketStatus` is untouched.
- `toListingMarket`, `toUserListingMarket` and `toListingMarketDetail` map the new fields. An object literal typed as `ListingMarket`, `UserListingMarket` or `ListingMarketDetail` must now supply `isLocked` (and `lockReasons` on the detail).
- Listing wire types regenerated from the current spec. Two of its changes reach the mapped surface:
  - **Breaking: `PoolTransactionPage.marketAddress` widens to `string | null`.** The backend's transaction history is no longer scoped to one market on the wire and echoes `null` when it was not. A consumer assigning it to a `string` must handle the `null`.
  - `toListingConfig` reads the renamed wire fields `recommended_deposit_usdc` / `minimum_deposit_usdc`; `ListingConfig`'s own field names are unchanged.
