---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Make subgraph reads filter flexibly: every filter is optional and applied only when passed, sent as one typed `where` object so an omitted filter is absent rather than null (an empty list still reads nothing).

- `getQuoteHistory`: `subAccounts` is optional; new `source` (diamond) and `marketIds` filters. `QuoteHistoryRow` adds the quote's raw indexed fields (`initialOpenedPrice`, `tradingFee`, `closeFee`, initial and live locked values, `leverage`, `marketPrice`, `closedPrice`, send/open timestamps), `source`, `subAccountOwner`, `sendQuoteTransaction` and the undecoded `openPositionMetadata`. `getPoolTradeHistory` rows carry the same fields.
- `getQuoteFunding`: optional `source` filter.
- `getQuoteEventsByType` / `getQuotesEventsByType`: `types` is optional and accepts any subgraph event type (`QuoteSubgraphEventType`), with row types narrowed to what is passed; optional `source` filter.
- New entity reads with query options and React hooks: `getMarginTransfers` (`useMarginTransfers`), `getLiquidationDetails` (`useLiquidationDetails`), `getSubgraphQuotes` (`useSubgraphQuotes`), `getQuoteFundingSettlements` (`useQuoteFundingSettlements`) and `getFundingIndexCheckpoints` (`useFundingIndexCheckpoints`). Each returns one `SubgraphPage` (`rows`, `hasMore`) and pages by `first` / `skip` or the `idGt` cursor.
- `MarginTransferType` gains `EmergencyRecover`.
