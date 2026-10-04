---
"@symmio/trading-core": minor
---

**Solver fees on quote-history rows.** `QuoteHistoryRow` now decodes the `solverFees` list off each event's immutable `metadata` snapshot into three 18-decimal-wei fields: `solverFee` (the rate-based `SOLVER_FEE` entry), `staticSolverFee` (the flat `STATIC_SOLVER_FEE` entry), and `totalSolverFee` (the sum of every entry, including tags a future contracts release may add, so the total never under-reports). All three are `bigint | null` and read `null` when the event recorded no fees at all — liquidation and ADL rows, and deployments indexed before the fee was recorded. The untruncated list stays available on `rawMetadata`. `getPoolTradeHistory` shares the mapper, so its rows carry the fields too.
