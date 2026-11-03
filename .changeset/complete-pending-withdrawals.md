---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add complete multi-account pending withdrawal reads with `getPendingWithdrawRequestsBatch` and `usePendingWithdrawRequestsBatch`. Normalize account sets, scan every bounded page even when earlier pages are empty, and reject incomplete results on RPC failure. Refresh batch queries in the affected deployment after confirmed withdrawal writes.
