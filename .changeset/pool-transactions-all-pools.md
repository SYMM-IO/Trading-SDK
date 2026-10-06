---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

**Pool transactions across every pool.** `getPoolTransactions` / `usePoolTransactions` now read the listing backend's deposit and withdrawal history across all pools, newest first, with optional server-side filters: `tokenAddress`, `marketChainId` (the chain the pool's token lives on), `walletAddress`, `transactionType` and `transactionStatus`. Every parameter is optional; with none, the page spans every pool. Each `PoolTransaction` now names its own pool (`tokenAddress`, `chainId`), and `PoolTransactionPage.marketAddress` is `null` on an unscoped page. The query key carries every filter, and the query factory forwards every parameter to the action.

- `marketAddress` is deprecated in favour of `tokenAddress`. It keeps working — the SDK sends it as `token_address`, `tokenAddress` wins when both are set, and both spellings share one cache entry.
- The default page `size` drops from 150 to 50. The listing backend now caps this endpoint's `size` at 50 and rejects anything larger with a `422`, so the old default failed on every deployment.
- The service fixes the order — newest first — and takes no sort parameter.
- `ListingDepositChainId` gains `ROBINHOOD` (4663) and `ARC` (5042), deposit chains the listing service already reports. An exhaustive `Record<ListingDepositChainId, …>` needs the two new keys.
- Code that builds `PoolTransaction` objects by hand (test fixtures, mocks) needs the new `tokenAddress` and `chainId` fields.
