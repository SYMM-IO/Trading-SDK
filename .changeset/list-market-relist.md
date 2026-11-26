---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

BREAKING: pools are now listed through the listing service's `POST /v2/market/list-market` route. The service deprecated `/v2/market/add-market`, so the add-market API is removed, not kept alongside.

- **Removed (core):** `addMarket`, `addMarketMutationOptions`, `AddMarketParameters`, `AddMarketReturnType`, and the `ADD_MARKET_FAILED` error code.
- **Removed (react):** `useAddMarket`, `UseAddMarketParameters`, `UseAddMarketReturnType` and `AddMarketVariables`.
- **Added:** `listMarket` / `listMarketMutationOptions` (`mutationKey: ["listMarket"]`) in core and `useListMarket` in react. One call lists a new token or relists a delisted market. The request body and the `CreatedPool` result are the same as before.
- **Renamed:** `toAddMarketRequest` is now `toListMarketRequest`. `toCreatedPool` and `CreatedPool` are unchanged.
- **Errors:** failures surface as `LIST_MARKET_FAILED` and keep the service's `status` and `responseData` (`status` is `0` when no response came back). A chain with no listing backend still throws `LISTING_NOT_CONFIGURED` before any request.
- **Cache:** on success `useListMarket` refreshes the catalog, Your Pools, market detail, listing status and the weekly listing limit. `useAddMarket` refreshed only the first two.

**Migrating:** rename `addMarket` → `listMarket`, `addMarketMutationOptions` → `listMarketMutationOptions`, `useAddMarket` → `useListMarket`, `AddMarketParameters` → `ListMarketParameters`, `AddMarketVariables` → `ListMarketVariables`, `toAddMarketRequest` → `toListMarketRequest`, and match `LIST_MARKET_FAILED` instead of `ADD_MARKET_FAILED`. The parameters do not change.
