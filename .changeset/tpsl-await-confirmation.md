---
"@symmio/trading-react": minor
---

Grouped TP/SL now waits for the handler's notification before reporting success.

`useSetQuoteGroupTpSl().set()` and `useDeleteQuoteGroupTpSl().deleteOrders()` used
to resolve as soon as every request had been accepted, leaving confirmation to
run on in the background. They now resolve only once the WebSocket has reported
each step — live for a write, gone for a cancel — so awaiting them means the
exits are real rather than merely submitted.

Three things had to change for that to be true rather than accidental:

- **The runs subscribe to the right channel.** Reports arrive on the Virtual
  Account, and a grouped position can span several; the set run watched the
  sub-account and the cancel run watched only the first VA, so both relied on a
  co-mounted read hook's subscription to confirm anything. Both now watch every
  VA their plan touches. `notificationsAccounts` replaces the deprecated
  single-address `notificationsAccount`.
- **A racing refetch can no longer erase a pending write.** The post-request
  refetch routinely beat the handler's own bookkeeping and came back empty,
  folding the side to `canceled` and blanking the price the trader had just set.
  `markConfirming` now records the `intent` behind a `"confirming"` side and
  `setRows` holds a pending write until the rows list it, a report lands, or the
  guard window closes. New `clearConfirming(id, side)` releases it.
- **The wait is bounded.** `confirmationTimeoutMs` (default 45s) refetches the
  handler's rows and, failing those, fails the step with
  `error.code === "TPSL_CONFIRMATION_TIMEOUT"` — distinct from a rejected
  request, and still counted in `submittedCount` / `deletedCount`.

Both summaries gain `confirmedCount`, and `progressPercent` now advances on
confirmations rather than on acceptances, so a progress bar no longer reads 100%
while the handler has yet to answer.
