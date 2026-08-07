---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add grouped partial close — close an exact quantity across a merged position, and fix the group's notional and leverage figures.

A `QuoteGroup` is several on-chain quotes, so closing "2.8 of the position" means splitting that amount across children without leaving a remainder the contract will reject. `core` gains a `close-planning` slice:

- `planGroupClose` / `PlanGroupCloseResult` — a pure, deterministic greedy plan over the children (largest open size first, `key` as tie-break) that sums to the target **exactly** or fails without closing anything. Each candidate is either closed in full or partially down to its dust cap, with the excess spilled to the next child. Failures are typed: `exceeds-open`, `nothing-to-close`, and `dust-locked` (every remaining child sits at its cap) — the last carries `closeableQuantity`, the largest amount that would have worked, so a UI can offer it instead of a bare error.
- `minRemainingQuantityOf` — the smallest remainder a quote may keep after a partial close, `ceil(openQuantity × minAcceptableQuoteValue / (cva + lf + partyAmm))`. This mirrors perps-core v0.8.5 `LibQuoteClose.closeQuote` ("Remaining quote value is low") and rounds **up**, because a remainder one wei short reverts on-chain. A quote with no partyA-locked value on record is reported as full-close-only.
- `toGroupCloseCandidates` — the `UnifiedQuote[]` → `GroupCloseCandidate[]` adapter.

`react` gains `useCloseQuoteGroup`: it plans the allocation, submits **every** child close in one bulk request (`instantCloseBulkAuto`), then tracks settlement per child off the account's live notifications — a step flips to `closed` on its close-**fill** frame, advancing `closedQuantity` / `progressPercent`, and the run reaches `success` only once every child confirms. The returned `close()` promise resolves at **submit** time, not settlement; read `status` / `steps` for the rest.

**Breaking — `QuoteGroupMetrics.notional` is renamed to `initialNotional` and changes meaning.** It was `Σ(openQuantity × openPrice)`, which shrank as a position was partially closed; it is now `Σ(quantity × (initialOpenedPrice ?? requestedOpenPrice))` — the frozen at-open notional, unaffected by partial closes. Rename the field at the call site; if you were rendering "current position value", multiply `weightedOpenPrice` by `openQuantity` yourself rather than reusing this field.

Two figures were also wrong and now change value:

- **Group leverage** was `notional / (cva + lf + partyAmm)` off the current locked values — it drifted as a position was partially closed and it omitted `partyBmm`. It is now `Σ(quantity × (requestedOpenPrice ?? openedPrice)) / Σ(cva + lf + partyAmm + partyBmm)`, each child folding its frozen `initialLockedValues` when known. This is blended **opening** leverage and it holds steady across partial closes.
- **`calculateQuoteLeverage`** returned `"0"` for a quote whose `requestedOpenPrice` is `0` (a market order, where only the settled price exists). It accepts an optional `openedPrice` used as the reference price in exactly that case. Existing callers are unaffected.
