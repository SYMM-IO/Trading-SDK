---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add margin & risk — read a merged position's margin, equity and distance to liquidation as one figure set.

`core` gains a `margin` slice:

- `calculateMarginRisk` / `MarginRiskMetrics` — a pure, **single-account** fold of `balanceInfoOfPartyA` plus the account's unrealized PnL into `totalMargin`, `maintenanceMargin` (`lockedCVA + lockedLF`), `initialMargin` (`+ lockedPartyAMM`), `equity`, `remainingToLiquidation`, `liquidationBufferPercent` and `isLiquidatable`. `isLiquidatable` is bit-for-bit the on-chain predicate `allocatedBalance − (cva + lf) + upnl < 0` (`LibAccount.partyAAvailableBalanceForLiquidation`, perps-core v0.8.5), so a UI never has to approximate it with a threshold on the buffer percent.
- `aggregateGroupUpnl` / `QuoteGroupUpnl` — a pure bigint fold of a group's children into one signed unrealized-PnL total at the current mark price, with an `isComplete` flag so a group whose fill price has not settled reads as "PnL unknown" rather than "no PnL". Resting orders contribute nothing and are not counted as unvalued.
- `decimalPriceToWei` — decimal price string to 18-decimal wei. Returns `undefined`, never `0n`, for an unparseable input: a fabricated `0n` mark price makes a uPnL fold report a −100% loss.

`react` gains `useAccountMarginRisk` (one account) and `useQuoteGroupMarginRisk` (a `QuoteGroup`: resolves its Virtual Account, folds the group uPnL against a mark price you inject or it subscribes to, and returns the metrics alongside the account's liquidation price).

**Margin risk is per liquidation domain and is never blended.** Each Virtual Account is liquidated on its own balance, so a group spanning several accounts reports `isMultiAccount: true` with `metrics: undefined` and exposes `accounts` — call `useAccountMarginRisk` per address. Summing balances across accounts would hide an account that is about to be liquidated behind a comfortable-looking average.

`liquidationBufferPercent` is an 18-decimal fixed-point percent and is **not clamped**: it exceeds `100%` on a profitable book, goes negative once liquidatable, and is `undefined` when the zero-uPnL cushion is not positive. Clamp it at the render layer if you draw a bar.

`sharePercent` moved from the TP/SL slice to shared utilities, and `triggerPriceToWei` now delegates to `decimalPriceToWei`. Both keep their exported name, signature and behaviour — no consumer change.
