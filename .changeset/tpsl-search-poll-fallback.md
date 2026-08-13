---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Confirm grouped TP/SL from the handler when the WebSocket report never arrives.

**Fixes a false confirmation.** A pending write used to be settled by any
snapshot that listed the side — including a _stale_ one. Editing a take-profit
from 150 to 160 and refetching before the handler caught up reported the edit as
confirmed and rendered 150 as though it were live. A write is now settled only
by evidence of the order that was actually submitted: a matching `coh_quote_id`,
or a matching trigger price and price type. Confirmations that seeded neither
behave as before. This closes the same hole on the existing per-quote read,
where a window-focus refetch could trigger it, and it flips the expectation of
one store test.

**Adds the fallback sweep.** New `searchTpSlOrders` in core wraps
`POST /api/v5/search/`, returning `{ orders, count, isComplete }` for one
account. The WebSocket report keeps the first `fallbackPollDelayMs` (default
30s) to itself; only if none arrives does the run start reading the handler
directly, every `fallbackPollIntervalMs` (default 2s, `0` disables), confirming
from whichever signal lands first. In the normal case the report resolves the
wait long before the delay elapses and no sweep request is ever sent.

Once running it costs one request per Virtual Account per tick — never one per
leg — shared between concurrent runs on the same account, single-flight, with
exponential backoff on handler errors. The sweep is owned by the wait rather
than by a component, so closing the modal mid-run does not silence it.

Two rules keep an account-wide page from doing damage:

- **Absence only counts on a complete page.** `isComplete` is derived from
  `orders.length < size` rather than from `count`, whose meaning on this
  endpoint is unverified. A truncated response contributes positive rows only,
  so a live order can never be reported as cancelled.
- **A cancel confirms on its own `coh_quote_id` disappearing**, not on an empty
  result — which also means a row the store has not yet linked to a quote cannot
  masquerade as one.

Supporting changes: `setRowsForSides(id, rows, sides)` folds a snapshot over
named sides without the `quote_id` aliasing (an account-wide page handed to
`setRows` would fuse two legs of a group into one record); `clearConfirming`
gains a sibling on the store's public surface; and a no-op commit is now skipped
entirely, so a 2s sweep does not wake every waiter and re-render every TP/SL cell
on each tick that merely confirmed the status quo.

`DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS` rises from 45s to 60s so it covers both
halves of the wait: 30s belonging to the report, then roughly fifteen sweeps.
`TPSL_CONFIRMING_GUARD_MS` rises to 90s to stay clear of it, so a grouped run
always reaches its own deadline and releases the store guard itself rather than
having the guard expire underneath it.
