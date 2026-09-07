---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Relayed gasless writes now confirm before they resolve.

An explicit relay used to resolve on the `202` acceptance — milliseconds after submit, seconds before the transaction landed. The mutation therefore resolved before its own effect existed, and following it to a terminal status was the consumer's job, hand-built and easy to omit. Omitting it produced a UI that sat on `queued` forever while the operation had in fact succeeded.

**`@symmio/trading-core`**

- New `confirmGaslessRequest(config, { requestId, until })` — the opinionated layer above `waitForGaslessRequest`. Resolves only on `succeeded`; `reverted` / `failed` / `rejected` throw as `GASLESS_RELAY_REVERTED` / `GASLESS_RELAY_FAILED` / `GASLESS_RELAY_REJECTED` with the record on `responseData`. With `until: "receipt"` it also waits for the receipt on your own client, so the state is readable by the reads you are about to invalidate. A receipt-wait timeout resolves without a receipt rather than throwing — the relay already reported the transaction mined.
- `getGaslessRequestQueryOptions` **now polls by default**: 1.5 s while `queued`, 3 s after `submitted`, stopping at a terminal status; it retries up to three post-`202` `404`s (the accept-vs-record race) and treats a terminal record as permanently fresh. Previously the cadence was documented but not implemented, so a caller who passed no `refetchInterval` fetched once and froze. Every default yields to an explicit `query.*` override.
- `GASLESS_QUEUED_POLL_MS` / `GASLESS_SUBMITTED_POLL_MS` moved to the slice root beside the status enum (same public names), joined by `gaslessPollDelay` and `GASLESS_RECEIPT_TIMEOUT_MS`.
- `waitForGaslessRequest` is unchanged, deliberately: it still resolves for every terminal, including failures. The "succeeded or throw" opinion lives one layer up.
- The transparent write path is unchanged: it still waits only for broadcast and returns a `txHash`, so ordinary write hooks' receipt-wait and invalidation run as before.

**`@symmio/trading-react`**

- `useRelayInstantOperations`, `useGaslessWalletExecute`, `useSettleGaslessDepositNewAccount` and `useSettleGaslessDepositExistingAccount` now accept `GaslessRelayParameters` (`confirmation`, `receiptConfirmations`, `timeoutMs`, `receiptTimeoutMs`, `abortOnUnmount`, `onProgress`) and **confirm by default** (`confirmation: "receipt"`). Pass `confirmation: "none"` for the previous fire-and-forget behaviour.
- They resolve with `{ accepted, confirmed }` rather than the bare acceptance receipt, and expose `relay` — `{ phase, requestId, status, txHash }` — so a UI can show progress during a wait that may last as long as the relayer takes.
- On `succeeded` each hook invalidates the reads its action changed. All of them invalidate account balances and the fee allowance (the transport charges collateral); the deposit settlements also invalidate the swept address and, for a new account, the owner's sub-account lists. `useRelayInstantOperations` invalidates only transport-level reads — `operationType` is free-form, so the SDK cannot know which domain reads a batch touched.
- The wait aborts on unmount by default; the invalidation still runs whenever a `succeeded` terminal was observed, so navigating away mid-wait does not leave the cache stale.
- This also removes the `useSettleGaslessDepositNewAccount` caveat that a `succeeded` settlement is not instantly readable: the receipt is awaited on the same client the invalidated reads use.
