---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Split fee previews by when fees are charged: the open flow prices only what the open charges, and a new close-fee preview prices close fees at close time — where the notional, the decaying solver rate, and the holding time are real.

**Deferred close fees.** The instant-open `addMargin` transfer now funds only the open-side legs (locks + platform open fee + solver open fee + static open fee + settlement provision). Close fees are charged at close from the position by the contract — never pre-funded — so opening a position no longer moves the round-trip fee up front.

- **New `getInstantCloseFees` / `useInstantCloseFees`** — close-fee preview: `platformCloseFee` plus, on lowcap (Enigma), the holding-time `closeSolverFee` (early → standard decay, priced at `now − openedAt`, capped by the `closeRateCap` the open signed), `closeSolverFeeRate`, `holdingSeconds`, and the flat `staticSolverFeeClose`. Kind-discriminated union with query options; the react hook prefetches every input so the query function is pure math.
- **`getInstantOpenFees` / `useInstantOpenFees` slimmed to open-side legs**: `platformOpenFee`, (lowcap) `openSolverFee` + `staticSolverFeeOpen` + `expectedSettlementLoss`, `notional`, `quantity`, `totalFee`. The close-side fields (`platformCloseFee`, `closeSolverFee`, `staticSolverFeeClose`) are gone — preview them with `getInstantCloseFees`. New `includeSettlementInTotalFee` parameter (default `true`) controls whether `totalFee` includes the settlement provision.
- **`calculateAvailableInstantOpenMargin`** no longer shaves the close fee (shave is now `1 − leverage × openFee`); its `closeFee` parameter is deprecated, optional, and ignored.
- **Full-balance sizing** budgets open-side costs only and carves just the static open fee off the balance — the same balance sizes a slightly larger position.
- Fixed: `prepareInstantOpenParamsQueryOptions` and `getInstantOpenFeesQueryOptions` leaked/dropped fields between the options bag and the SDK call (`query` leaked into the wizard; `solverInfo` prefill was dropped).
