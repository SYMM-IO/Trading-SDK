---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add LIMIT orders, force-close, and force/request cancel — capability-gated writes for solvers that support resting orders and the on-chain escape hatches for stuck quotes.

**Solver capabilities.** `getSolverCapabilities` reads a solver's declared feature flags into `SolverCapabilities`; `supportsLimitOrder` and `supportsGroupClose` are the boolean gates. Flags default to `false` — a solver must **declare** a capability to enable it — so a UI degrades gracefully instead of erroring against a solver that lacks the feature (Rasa/majors declare `limitOrder`; Enigma/lowcap declares `groupClose`).

**LIMIT open / close.** `prepareLimitOpenParams` / `prepareLimitCloseParams` take the same inputs as their instant (market) twins, except the caller supplies an explicit resting **`price`** instead of a `markPrice` + `slippage` band. The order rests at exactly that price with **zero slippage** applied, and the request is tagged `orderType = LIMIT`, so the hedger writes a **pending** on-chain quote at that price rather than filling at mark. `limitOpenAuto` / `limitCloseAuto` are the prepare-then-submit one-call convenience actions.

**Force-close.** When a solver stops answering close requests, `forceClosePosition` closes a quote directly on-chain against a Muon `priceRange` attestation (`HighLowPriceSig`, from `getForceClosePriceSig`), wrapped in the AccountLayer `_call` proxy. `checkForceCloseEligibility` / `findForceCloseWindow` / `previewForceClosePrice` / `getForceCloseParams` are the pure and read-side helpers that decide whether a force-close is allowed and at what price (`ForceCloseEligibility`, `ForceCloseIneligibleReason`, `ForceCloseWindow`); `forceCloseAuto` fetches the signature and submits in one call.

**Force / request cancel.** The two-step cancel escape hatch for pending quotes, all routed through the `_call` proxy so the caller is the subaccount:

- `requestToCancelQuote` → `forceCancelQuote` — cancel a pending open (e.g. a resting LIMIT order): request first, force it after the cooldown if the solver does not act.
- `requestToCancelCloseRequest` → `forceCancelCloseRequest` — the same pair for a pending **close** request.

`@symmio/trading-react` adds `useSolverCapabilities` / `useSupportsLimitOrder` / `useSupportsGroupClose`, `useLimitOpenAuto` / `useLimitCloseAuto` and `useLimitOrders` (the resting-order list), `useForceClose` / `useForceCloseEligibility` / `useForceCloseParams`, and `useForceCancelQuote` / `useRequestToCancelQuote` / `useForceCancelCloseRequest` / `useRequestToCancelCloseRequest`.
