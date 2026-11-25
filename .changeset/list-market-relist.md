---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add `listMarket` / `listMarketMutationOptions` (core) and `useListMarket` (react), which list a token or relist a delisted market through the listing service's `POST /v2/market/list-market` route, with the same parameters and `CreatedPool` result as `addMarket`. Failures surface as `LIST_MARKET_FAILED`. `useListMarket` also refreshes market detail, listing status and the weekly listing limit on success. `addMarket`, `addMarketMutationOptions` and `useAddMarket` are deprecated in favour of the new API; they keep working unchanged and will be removed in the next major release.
