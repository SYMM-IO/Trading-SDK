---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add a pre-listing token price read — the Price Service's USD estimate for a token before (or regardless of whether) it is listed as a pool, from the listing backend's authed `POST /v2/market/token-price`.

`core` gains:

- `getTokenPrice` (plus `getTokenPriceQueryKey` / `getTokenPriceQueryOptions`) and its `TokenPrice` row — `{ price }`, USD per token as the service reports it. The read takes the listing bearer `accessToken`, the token's `chain` and its `tokenAddress`. The backend caches the figure for about five minutes and rate-limits the endpoint, so the query options default both `staleTime` and `gcTime` to five minutes; the same inputs inside that window are served from the cache with no refetch, and a `query` override wins.
- `TokenPriceChain` — the chains the endpoint accepts, by vendor chain **name** (`BASE`, `SOLANA`, `BSC`, `ARBITRUM_ONE`, `SONIC`, `ROBINHOOD`, `ARC`). It is a different key space from the numeric `ListingDepositChainId`; `ROBINHOOD` and `ARC` have no numeric twin.
- `toTokenPrice` — the mapper from the raw response.

`react` gains `useTokenPrice`, which stays idle until both the `accessToken` and the `tokenAddress` are non-empty and normalizes failures to `SymmioRequestError`.

**Errors** — an empty `accessToken` throws `MISSING_ACCESS_TOKEN` and a `chain` outside `TokenPriceChain` throws `UNSUPPORTED_TOKEN_PRICE_CHAIN`, both `kind: "validation"` and both before any request. A failed request is `FETCH_TOKEN_PRICE_FAILED`: a `401` on a bad or expired token, a `422` on an address the service cannot resolve, and a `429` once the rate limit is exhausted (`retryAfterMs` carries the wait when the service sends one).

**It is an estimate.** Render it with a `~`, never treat it as a mark or trade price, and do not poll for a fresher one.
