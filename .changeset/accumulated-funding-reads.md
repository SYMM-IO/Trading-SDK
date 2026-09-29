---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add accumulated-funding reads — the funding a position has accrued on-chain but not yet settled, and the per-pair funding state it accrues from.

`core` gains:

- `getQuotePendingFunding` (plus `getQuotePendingFundingQueryKey` / `getQuotePendingFundingQueryOptions`) and its `QuotePendingFunding` row — pending funding for a batch of quote ids, read from the diamond view `getQuoteFundingDebts`. Ids are de-duplicated, sorted and read in sequential batches of `batchSize` (default 25); each batch is its own `eth_call` against the RPC's latest block, so rows from different batches can come from adjacent blocks. The value is what the contract would settle if the quote were charged in that block, in 18-decimal collateral units, and moves in whole-epoch steps. The query key accepts a partial scope, so `predicateMatch(getQuotePendingFundingQueryKey, { configKey })` matches every pending-funding read of a chain.
- `getFundingFeesOfPartyB` (plus `getFundingFeesOfPartyBQueryKey` / `getFundingFeesOfPartyBQueryOptions`) and the `FundingFee` struct — the raw accumulated-funding state a solver keeps for one symbol. Its `epochDuration`, `startEpoch` and `startEpochTimeStamp` tell whether the pair is not configured, configured but not started, or accruing.
- `isActiveQuoteStatus` — whether a known on-chain status is an active position (`OPENED`, `CLOSE_PENDING`, `CANCEL_CLOSE_PENDING`, `LIQUIDATED_PENDING`); `isActivePosition` now delegates to it.

`react` gains `useQuotesPendingFunding` (per-quote rows aligned 1:1 with the input plus the `pendingNetReceived` sum), `useQuotePendingFunding` (the single-quote form) and `useFundingFeesOfPartyB`. `useManagedQuotes` invalidates the pending-funding reads along with its other on-chain quote reads, and `useForceClose` invalidates them once the write succeeds (after its receipt, by default). Nothing polls by default; pass `query.refetchInterval`.

**Sign convention** — `pendingNetReceived` is income-positive like every SDK funding amount: `> 0n` means the position will receive the funding, `< 0n` means it owes it. It is the negation of the contract's cost-positive `getQuoteFundingDebts`, so it sits next to the settled `netReceived` with no sign flip. The `FundingFee` rates are raw per-unit contract values and stay cost-positive (positive = that side pays).

**Active positions only** — the view does not check quote status. A quote a solver locked but never opened (`LOCKED`, `CANCEL_PENDING`, or `CANCELED` / `EXPIRED` after a lock) reads as a meaningless amount that grows every epoch. The React hooks read only rows with a `quoteId` and a known active `quoteStatus`; core callers filter with `isActiveQuoteStatus` first.

Pending funding is not in the subgraph, and settled (`getQuoteFunding`) plus pending funding is not a lifetime total, because the two are read from different sources at different heights. A Muon-signed uPnL already includes pending accumulated funding; the SDK's mark-price uPnL does not. Both views are identical on v0.8.5 and v0.8.6, so there is no version gate.
