---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add grouped TP/SL — read, plan, set and cancel take-profit / stop-loss orders across a merged position.

A `QuoteGroup` is several on-chain quotes, and the conditional-order handler takes one signed request per quote. `core` gains a pure `tpsl/grouping` slice that folds those legs into one state and works out the smallest honest fan-out:

- `toGroupTpSlChildren` / `summarizeQuoteGroupTpSl` / `toGroupTpSlOrders` — the cell and overview data model, with **notional-weighted** coverage rather than a count ratio.
- `planGroupTpSl` — diffs a desired state against what the handler already holds, so an unchanged leg is never resubmitted and an unchanged side is dropped from its leg. Emits `set` / `delete` / `skip` per child with typed skip reasons and per-child validation.
- `planGroupTpSlDelete` — the cancel-all plan, reading each `cohQuoteId` off the confirmed snapshot and excluding in-flight sides.
- `estimateGroupTpSlReturn` — signed return if every staged trigger fires.

`react` gains `useQuoteGroupTpSl` (one query per leg on the shared TP/SL key, one socket per distinct account), `useQuoteGroupTpSlEditor` (edit buffer, apply-to-all, live validation and plan), `useSetQuoteGroupTpSl` (sequential signed writes with per-leg progress and retry-failed-only) and `useDeleteQuoteGroupTpSl` (bounded-parallel cancels).

`useSetQuoteGroupTpSl` executes **both** halves of the plan: a side the caller clears becomes a `deleteQuoteTpSl` cancel, a side with a new value becomes a `setQuoteTpSl` write, and one leg can do both in the same run. Steps carry a stable `id` and a `kind` (`"write" | "cancel" | "skip"`) because a leg can now produce several.

Run reporting is stricter as a result:

- `confirming` outranks `partial`, so a failure on one leg no longer makes the run terminal while another still awaits its handler report.
- `acceptedCount` replaces the old `completedCount` and **excludes** failures; `failedCount` is reported alongside it.
- A step is only confirmed by the transition it is actually waiting for — a _live_ report for a write, a _gone_ report for a cancel — so a shared socket cannot cross-confirm.
- `retryFailed` merges onto the previous step list instead of replacing it, so successful legs keep their state.
- A rejected wallet signature stops the run by default (`stopOnUserRejection`) rather than prompting for every remaining leg.

Also fixes `useQuoteTpSl`, which returned a cast object whose `isLoading` / `isFetching` / `error` / `refetch` were `undefined` at runtime. It now returns those for real; the underlying query stays available as `query`.

The React TP/SL hooks now refetch the handler's authoritative rows on a successful set or cancel (`invalidateTpSlReads`), so a box resolves out of `confirming` — and a cancelled side clears — even when the live WebSocket frame is missed. This applies to `useSetQuoteTpSl` / `useDeleteQuoteTpSl` and both grouped hooks.

Grouped TP/SL run steps now resolve from the shared store (fed by every WebSocket subscription and the success refetch) rather than from each run hook's own subscription. A step no longer sticks on `confirming` when the handler's notification arrives on a channel that hook did not subscribe to.
