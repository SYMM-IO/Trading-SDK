---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Rework instant-open sizing and funding around the solver's estimated fill price.

`calculateTradeParams` now sizes collateral-input quantity from the raw mark price instead of the slippage-adjusted requested-open price. Slippage changes the execution bound without silently resizing the position while preserving the existing input and output structures.

For lowcap instant opens, `prepareInstantOpenParams` now:

- accepts an optional pre-fetched `estimatedOpenPrice` and can derive slippage automatically when the caller omits it;
- validates the estimated fill against the effective slippage tolerance;
- includes solver open/close fees and expected mark-to-fill settlement loss in the margin transfer; and
- applies 1% funding headroom to the SHORT margin basis to cover lock growth when the final fill is above the estimate.

Add `getInstantOpenFees`, its query helpers, and `useInstantOpenFees` for a normalized platform-fee, solver-fee, settlement-loss, and total-funding preview. Also export the supporting fee and calculation helpers and types.
