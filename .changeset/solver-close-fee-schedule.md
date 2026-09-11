---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Provision the worst-case solver close fee, and price a close by how long the position was held.

The solver charges more to close a freshly opened position than an aged one: the close-fee rate starts at `hedger_fee_close_early_rate`, holds flat until `hedger_fee_close_early_threshold` seconds, then decays linearly to the standard `hedger_fee_close` by `hedger_fee_close_standard_threshold`. With the staging numbers a close pays `0.0024` up to 30s, `0.0006` from 180s on, and interpolates between. The SDK priced the close fee as the flat `hedger_fee_close` everywhere — so an open under-provisioned its own close, and an immediate close came up short in the VA.

**`@symmio/trading-core`**

- The close-fee decay is exposed as **flat fields** mirroring the wire — `hedgerFeeCloseEarlyRate`, `hedgerFeeCloseEarlyThreshold`, `hedgerFeeCloseStandardThreshold` — alongside the existing `hedgerFeeClose` (the floor). They are carried on **`EnigmaMarket`** (from `getMarkets` / `/contract-symbols`) and on `SolverSymbol` (from `getSymbols` / `/symbols`); both wire endpoints return them. Enigma-only — a Rasa market has neither the wire fields nor the SDK fields. No nested object: the fields stay greppable and the shape stays flat.
- New `SolverCloseFeeRates` (the four flat fields as a param type) with `getSolverCloseFeeRate(fees, holdingSeconds)` and `calculateSolverCloseFee(fees, { notional, holdingSeconds })` — the rate/amount the solver charges to close a position held `holdingSeconds` (`now − createTimestamp`). Piecewise: peak until the early threshold, linear decay between the thresholds, floor after. An `EnigmaMarket` or a `SolverSymbol` satisfies `SolverCloseFeeRates`, so pass either straight in. A negative holding time clamps to the peak; a market with no decay collapses to the flat rate. `toThresholdSeconds` coerces a wire threshold to whole seconds.
- `calculateSolverFees` accepts the optional flat early-rate fields. When the early rate is given, the close leg provisions the **worst case** — `hedgerFeeCloseEarlyRate × notional`, the fee a just-opened position would pay — instead of the flat `hedgerFeeClose × notional`. `resolveMarket` resolves the fields under `includeHedgerFees`, so the open-fee preview (`getInstantOpenFees`) and the open wizard (`prepareInstantOpenParams`) provision accordingly from the market they already read — `addMargin` funds an immediate close. `EnigmaInstantOpenFees.closeSolverFee` is now that worst-case figure.

**`@symmio/trading-react`**

- `useInstantOpenFees` reads the early-close rates from the same `useMarkets` data it already fetches (no second request), so the previewed `closeSolverFee` matches what the open provisions. `InstantOpenMarketData` accepts the pre-fetched flat rate fields.
