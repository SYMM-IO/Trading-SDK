---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

An ambiguous gasless submit can no longer double-execute, and a lost response can be replayed byte for byte.

A relay submit that failed with a timeout, a `502` or a status `0` used to look like a definitive outage: `isConfirmedGaslessUnavailableError` matched any `404`/`502`/`503`, and the transparent dispatcher took the wallet path on it under `fallback: "wallet"`. But the gateway returns `502` for an upstream failure _and_ for an instance mismatch, either of which can happen after the body reached the service — so a request the relayer had already accepted could be paid for a second time from the wallet. The retry story was thin in the same place: one blind resend, no `Retry-After`, and no way to recover the bytes once both attempts were gone.

**`@symmio/trading-core`**

- Every submit (`relayInstantOperations`, `gaslessWalletExecute`, `relayGrantDelegation`, both deposit settlements) now goes through one internal disposition:
  - a `429`, or a `503` carrying the gateway's `{ error }` envelope, is resent under the **same key** after `max(retryAfterMs, 1 s + jitter)`, at most twice and only while the wait fits inside `execution.submitTimeoutMs`. The gateway dropped the request, so nothing can have executed;
  - an ambiguous failure (status `0`, a timeout, a `5xx` without that envelope) is resent **once**, then thrown as `GASLESS_SUBMIT_UNCONFIRMED`;
  - a `2xx` with no `request_id` is unconfirmed too;
  - a `2xx` from the wrong protocol instance throws `GASLESS_INSTANCE_MISMATCH` with the parsed body — its `request_id` — kept in `responseData`.
- New `getGaslessUnconfirmedSubmit(err)` returns the replayable `GaslessUnconfirmedSubmit` (`{ chainId, service, path, body, idempotencyKey }`), and `resubmitGaslessRequest(config, submit)` (with `resubmitGaslessRequestMutationOptions`) POSTs those bytes unchanged. A deposit replay re-reads the wallet's deterministic address before the POST, exactly as the original settlement did.
- New `isGaslessIdempotencyConflictError(err)` for the vendor's `409 IDEMPOTENCY_KEY_CONFLICT`.
- New `classifyGaslessFailure(err)` reduces any gasless failure to one `GaslessFailureReason` — `"payer-balance"`, `"fee-allowance"`, `"free-quota"`, `"failed-operation"`, `"submit-unconfirmed"`, … — reading the decoded revert ahead of the vendor code and the vendor code ahead of the HTTP status. New `decodeGaslessOperationFailure(err, abi)` names the failing batch entry of an `OperationFailed` revert and decodes its inner revert.
- `parseGaslessErrorDetail` now also surfaces `revertMessage`, `decodedRevert`, `rpcError` and `failedOperation`, read from both `detail` and `detail.details`.
- Every gasless error predicate reads `status` and `responseData` structurally, so they work unchanged on the error a React hook throws.

**Breaking changes** (the gasless slice is unreleased):

- `isConfirmedGaslessUnavailableError` no longer matches `404`, `502`, `504`, status `0` or a bare `503`. It matches exactly a `429` or a `503` with the gateway envelope. A gateway `404` is a configuration error, not an outage; the rest are ambiguous and surface as `GASLESS_SUBMIT_UNCONFIRMED`, which the predicate always refuses.
- `isConfirmedGaslessFeeLimitError` no longer requires HTTP `409`. It matches a fee code on **any** pre-acceptance `4xx`, a `400 SIMULATION_REVERTED` whose decoded revert is billing-specific (`OperationalFee: …`, `DailyFreeOpsLimitExceeded`, `FeeLimitExceeded`), or a `rejected` record with either. A `rejected` record with a non-billing cause no longer qualifies — a wallet retry would revert the same way.
- `idempotencyKey` is gone from `gaslessWalletExecute`, `relayGrantDelegation` and `GaslessWriteOptions`. Those re-sign on every call, so one key could only ever describe one signature; it is minted per call and echoed on the receipt. It stays a parameter on `relayInstantOperations` and both settlements, whose payload the caller builds.
- `GaslessContractRevert.arguments` widens to `readonly unknown[] | Record<string, unknown>`: the vendor sends keyed arguments on some deployments, and they used to be dropped. Narrow with `Array.isArray` before indexing.
- `GaslessErrorDetail` gains four fields, so an object literal typed as one must supply them.
- A submit's `202` with no `request_id` now throws `GASLESS_SUBMIT_UNCONFIRMED` rather than `GASLESS_ACCEPTANCE_INVALID`, because its bytes can be replayed. The old code remains as the parser's own invariant.

**`@symmio/trading-react`**

- New `useResubmitGaslessRequest` — confirms and invalidates like the other relay hooks, on the service and chain the recorded submit names.
- `classifyGaslessFailure`, `decodeGaslessOperationFailure`, `getGaslessUnconfirmedSubmit` and `isGaslessIdempotencyConflictError` are re-exported beside `parseGaslessErrorDetail`.
- The transparent dispatcher never falls back to the wallet on an unconfirmed submit, an idempotency conflict or a `2xx` from the wrong instance, and it records an unconfirmed submit on the nonce stream so the next write on it waits instead of re-signing the same nonce.
