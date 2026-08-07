---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add grouped funding — read the settled funding of a merged position as one total and one merged timeline.

`core` gains:

- `aggregateGroupFunding` / `QuoteGroupFunding` — a pure fold of the per-quote `QuoteFundingData` rows into a single group total. De-duplicates by `quoteId`, skips optimistic children, tolerates over-fetched rows, and reports `isComplete` so a partially-indexed group reads as "funding unknown" rather than "no funding".
- `getQuotesEventsByType` (plus `getQuotesEventsByTypeQueryKey` / `getQuotesEventsByTypeQueryOptions`) — the batched sibling of `getQuoteEventsByType`: many quote ids, one round-trip, rows already interleaved and sorted by `timestamp`, paged over the **merged** stream via `first` / `skip` and a `hasMore` flag. An omitted `first` asks for the 1000-row ceiling The Graph enforces, so an un-paged call returns everything one request can serve instead of a small default page.
- `FUNDING_HISTORY_EVENT_TYPES` — the charge-event subset behind a funding timeline (`PRICE_HISTORY_EVENT_TYPES` minus `SETTLE_UPNL`).

`react` gains `useQuoteGroupFunding` (the group total plus per-child rows aligned 1:1 with `group.quotes`) and `useQuoteGroupFundingHistory` (the merged, time-sorted per-tick timeline; every row carries its own `quoteId`, so a per-position breakdown is a client-side `groupBy`).

**Sign convention** — `net = paid − received` everywhere in this slice: a **positive** `net` means the user net-**paid** funding. This matches `QuoteFundingData.net` and the on-chain `int256`. A UI that colors "money in" green must invert at the render layer, never in the SDK.

**Settled to date only** — every total and row covers funding the protocol has already charged and the analytics subgraph has indexed. Funding accrued since a quote's last funding charge is not indexed anywhere and is therefore not included.

Two behavioural fixes ship alongside. Both can legitimately change numbers a consumer already renders:

- **`getQuoteFunding` now pages internally.** The Graph silently caps an un-`first`-ed query at 100 entities, so any batch above that was truncated: the extras came back as `missingQuoteIds`, and a caller that ignored completeness showed a wrong total. Ids are now chunked at `QUOTES_FUNDING_MAX_IDS_PER_REQUEST` (1000, newly exported), issued concurrently, and merged; callers pass the full id list however long it is.
- **`useQuotesFunding` no longer double-counts a repeated `quoteId`.** The sums fold over the distinct on-chain ids, and `net` is derived as `paid − received` so the aggregate keeps the row-level invariant. `rows` is now aligned 1:1 with `quotes` on every path — including while loading and when no on-chain ids were requested — and `missingQuoteIds` reports every requested id while the query is in flight or has failed, instead of an empty list that read as "nothing missing".
