# Decisions & Lessons

Mistakes made in past work, kept here so the next agent does not repeat them.

## 1. When you add or change a flow, take care of invalidating data — and ask the dev to confirm the list

What went wrong: I added flows (deposit-and-allocate, withdraw, cancel-withdraw) but
did not refetch everything they changed, so the UI showed stale values. For example,
after a withdraw the pending-withdraw list was not refreshed, and after deposit-and-
allocate the sub-account balance was not refreshed.

The rule:

- Any mutation that changes state (a deposit, allocate, withdraw, cancel, open, close,
  etc.) makes some reads stale. Before you finish, list every query that becomes wrong
  and invalidate it.
- Do the invalidation **after the transaction receipt**, not right after sending the tx
  (the on-chain state is not updated until the receipt).
- On-chain writes are **not** solver notifications, so a `live: true` read will not
  refetch on them — you must invalidate the query yourself.
- **Ask the dev which data should refetch, and confirm it with them.** Do not guess
  silently. Say what you plan to invalidate and let them add anything you missed.

Example (withdraw): after initiate/cancel withdraw, refetch the **withdraw list**
(pending withdraw requests) and the sub-account balances (`balanceOf`, `balanceInfo`).

## 2. In React, use the hook — do not call the core function and poke the query cache by hand

What went wrong: to read a sub-account I called the core function and built the
react-query cache key myself (`queryClient.getQueryData(getSubAccountQueryKey(...))`).
This is brittle — it has to match the exact key shape, it breaks when the key changes,
and it duplicates work the hook already does.

The rule: read data through the existing hook (for example `useSubAccount`), not by
calling the core function plus reaching into the cache. The hook owns the key, the
dedupe, the caching, and the refetch — so the data stays correct and reactive with no
key to keep in sync.
