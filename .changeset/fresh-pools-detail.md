---
"@symmio/trading-core": minor
---

Extend grouped pool positions with exact withdrawal previews and a pending LP ratio, and return pending-order and event-specific history metrics directly from their reads. Attribute opening fees to each partial close and omit closing fees on liquidation. Preserve fixed-point realized PnL through price subtraction in the shared quote primitive. Remove superseded unreleased scalar selectors; deposit estimates and running sums remain consumer-owned.

Support partial normalized cached snapshots in grouped calculations without fabricating missing amounts. Preserve backend ownership precedence, complete deposit/refund buckets, portfolio catalog metadata and historical reward totals, statistics fallback sources, and explicitly opted-in quote-lock liquidation estimates. Network reads retain required identities and authentication.
