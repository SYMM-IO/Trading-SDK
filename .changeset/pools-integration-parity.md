---
"@symmio/trading-core": major
"@symmio/trading-react": minor
---

Add listing validation, maintenance reads and four composed Pools APIs (portfolio, position, statistics and open positions), with matching React hooks that share existing source caches. Keep exact token/LP arithmetic, explicit partial-read gaps, legacy deposit floors, fractional rates and nullable event snapshots. Add optional single-use listing challenge prefetching.

Breaking: ListingRateLimits.marketConfigUpdatesPerDay and profitClaimsPerDay are now number | null. Handle null as unknown instead of assuming no operations are allowed. Existing rate fields retain their documented 18-decimal bigint contract; plain fractional backend percentages are normalized correctly.

The unreleased enrichment, scalar calculation and optimistic cache-patching exports from this branch are removed. External token data and consumer optimistic state stay in the app. Withdraw identifiers remain safely encoded. No release is published by this change.
