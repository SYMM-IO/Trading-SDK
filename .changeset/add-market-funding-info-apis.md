---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
"@symmio/utils": minor
---

Add market-info and funding-info solver APIs.

- **`@symmio/trading-core`**: new `getMarketInfo` (per-market 24h volume and lifetime value plus aggregate totals) and `getFundingInfo` (next-epoch long/short funding rates, next funding time, epoch length) reads, each with query-key and query-options helpers, plus `projectFundingRate` to extrapolate a per-epoch rate over a day window and the `toMarketInfo` / `toMarketFundingInfo` transformers.
- **`@symmio/trading-react`**: new `useMarketInfo` and `useFundingInfo` hooks wrapping the above. Neither polls by default; the caller opts in via `query.refetchInterval`.
- **`@symmio/utils`**: new `toFiniteNumber` numeric-coercion helper, exported from the root and from a new `@symmio/utils/number` subpath.
