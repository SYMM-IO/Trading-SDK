# Design Proposal: Caller-owned idempotency keys for gasless writes

**Status:** revision 2, awaiting approval · **Date:** 2026-10-19 · **Packages:** `@symmio/trading-core` (minor), `@symmio/trading-react` (patch)

## Summary

Gasless writes keep working as they do today. A consumer that needs recovery:

- passes its own idempotency key for each user action;
- saves the key with the action's context before calling;
- handles the outcome with SDK utilities.

While the GaslessQ service holds a key, it accepts that key at most once. So a retry under the same key, inside a bounded retry window, cannot run the action twice. Outside that window, or when the outcome stays unknown, the consumer reconciles from on-chain state instead of signing again. Storage, retries, locks, UI and the wallet fallback stay with the consumer.

The unreleased SDK-owned recovery engine on `feat/sdk-account-features` (`writeRecovery`, `beforeSubmit`, submit snapshots) is removed.

## Revision 2: changes after review

| Review finding                                                                                     | Change in this revision                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retry safety depends on key retention, atomic binding and scope, which were left to the next slice | Atomic key binding, a signer-independent scope and a retention period are now a **release gate** for this slice. Retries are allowed only inside a window measured from the first attempt. Outside it, the consumer reconciles. |
| A `failed` request may still execute                                                               | The predicate is narrowed and renamed to `isGaslessRequestRejectedOrRevertedError`. A `failed` request stays unresolved.                                                                                                        |
| A `409` or a broadcast hash was treated as enough to clear the record                              | A `409` leaves the action unresolved. A returned hash is followed to its receipt through the request id, and only then is the record cleared.                                                                                   |
| The nonce lock blocks a same-key retry for up to 20 minutes                                        | `nonce-lock.ts` is in scope. A same-key attempt never waits for its own pending submit, and different actions keep today's serialization.                                                                                       |
| The saved action lacked recovery context                                                           | The record pins owner, chain, billing account, resolved inputs, deployment and attempt times. `getGaslessDeploymentKey` provides the deployment fingerprint.                                                                    |
| Next slice: "every refusal becomes final" was too broad                                            | Narrowed: only a verdict the service recorded under the key settles earlier uncertainty.                                                                                                                                        |

Also new in this revision: each attempt's signature deadline is fixed when the call starts, and `GASLESS_SIGNATURE_LIFETIME_SECONDS` is exported. A consumer then knows exactly when an attempt can no longer execute.

## Background

The uncommitted work on `feat/sdk-account-features` added an SDK-owned recovery engine:

- `createConfig({ writeRecovery })`: a host adapter used by `createSubAccounts`. It supplied storage, an owner-wide lock, signer order, the wallet-fallback policy, legacy-record reconciliation and transport selection.
- `gasless.beforeSubmit`: an awaited hook that saved a signed `GaslessSubmitSnapshot` before every POST, so the request could be replayed byte for byte after a reload.

Integrating it into the consumer app showed these problems:

- The SDK's `executeRecoverableWrite` and the consumer's own journal both loaded, replayed, confirmed and cleared records, with control passing back and forth between them.
- App policy became public SDK types: signer order, wallet fallback, legacy records, proxy versus gateway, password lock.
- `createSubAccounts` behaved differently depending on global config. It returned after the receipt instead of after broadcast, threw new `GASLESS_WRITE_*` errors, and ignored the chain's `execution.fallback`.
- It covered one action, so the consumer kept a second recovery system for six other flows.
- Every consumer had to store and encrypt signed request bodies.

**Decision** (2026-10-17 to 2026-10-19): writes behave as before, the consumer owns recovery, and the SDK provides utilities. The GaslessQ backend has agreed to add a lookup by idempotency key (see [Backend dependency](#backend-dependency)). This slice is the part that does not depend on that lookup, and it is shaped so the lookup slice only adds to it.

**Why keys instead of snapshots.** Today the only status read is by `request_id`, and a client never receives that id if the `202` response is lost. Replaying the exact signed body was the only way to find such a request again. With a caller key reused on every attempt:

- **The service deduplicates.** While it holds the key, it accepts the key at most once. A re-signed retry either becomes the request, or is turned away while the earlier one stands.
- **The chain only covers the same nonce.** The InstantLayer accepts only `nonces[account] + 1` and rejects expired deadlines, so two signatures for the same nonce can never both run. It does **not** stop a retry signed with a later nonce after the first attempt already ran. That case relies on the service still holding the key, hence the release gate and the retry window.
- **Nothing secret is stored.** The consumer keeps a key, the action's inputs and its context.

## Goal

Every gasless submit can carry the consumer's own idempotency key for one user action, reused on every attempt inside a bounded window. Consumers can then recover interrupted gasless writes without SDK-held state and without storing signed requests.

## Reference

- **Consumer app (Vibe-ui-v2), the integration this is for:**
  - `src/features/vibecaps-create-sub-account/model/use-create-vibecaps-sub-account.ts`: the first flow to adopt keys.
  - `lib/symmio/write-recovery.ts`, `lib/symmio/gasless-recovery.ts`: the adapter and journal this replaces. The journal's deployment guards must survive in the replacement.
  - `lib/symmio/account-write.ts`, `margin-write.ts`, `withdraw-write.ts`, `oneClickSetup.ts`, `wallet-execute.ts`: the six journaled flows. They call `relayGaslessBatch` / `gaslessWalletExecute` and depend on `gasless.beforeSubmit` today.
  - `lib/symmio/gaslessFallback.ts` (`isRefusedBeforeAcceptance`), `lib/symmio/sessionKeySigner.ts` (`canRetryWithOwner`): the consumer's own copies of the refusal rule.
  - `docs/handbook/design-docs/GaslessQ-BE.md`:
    - § Idempotency: the same key returns the existing record.
    - § Status Lifecycle: `failed` is a "service or RPC failure … before successful receipt", reachable after `submitted`.
    - `userAddress` "does not need to be the raw signer".
    - The status `payload` is `{}` in the examples.
- **GaslessQ live OpenAPI** for operations and deposits, on the staging and production protocol instances (fetched 2026-10-17 and 2026-10-19). `idempotencyKey` is a string of at most 128 characters, a "stable retry key for this exact user action". Status is readable only by `request_id`. Neither instance documents lookup by key, retention or concurrent deduplication.
- **perps-core v0.8.6:**
  - `contracts/instantLayer/facets/Execution/ExecutionFacet.sol` lines 163–212: the deadline check, and `nonce == nonces[account] + 1`.
  - `docs/v0.8.6/pages/instant-layer-batch-delegation-grant.html`: "ordered nonce, and the deadline".
- **SDK today:**
  - `gasless/dispatch/submit-gasless-write.ts` mints a key per signature and sets the deadline after the nonce lock.
  - `gasless/nonce-lock.ts`: an unconfirmed submit blocks its stream for up to 120 s per call, until its signature expires, then throws `GASLESS_NONCE_STREAM_BUSY`. Its comment notes that a `failed` transaction can still mine late.
  - `gasless/http.ts` has `generateGaslessIdempotencyKey`, which is internal.
  - `gasless/write-request-registry.ts` has `getGaslessWriteRequest`, which maps a broadcast hash to its `requestId`.
  - `relayInstantOperations` and both deposit settlements already accept a caller key.

## Public API

All additions are in `@symmio/trading-core`. `@symmio/trading-react` gains no new API: its write hooks already forward their variables, so the new option and parameter reach core unchanged.

### `GaslessWriteOptions.idempotencyKey`

The existing fields are unchanged. The new field:

````ts
export interface GaslessWriteOptions {
  enabled?: boolean;
  fallback?: "error" | "wallet";
  account?: Address;
  broadcastTimeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Your key for one user action: 1–128 characters, from {@link generateGaslessIdempotencyKey}.
   * Save it with the action's recovery context before calling. While the service holds the key,
   * a call under it is accepted at most once, so after an unknown outcome you may call the same
   * write again with the same key, inside your retry window. A repeat whose earlier attempt was
   * accepted either follows that request or throws `409 IDEMPOTENCY_KEY_CONFLICT`
   * ({@link isGaslessIdempotencyConflictError}). The earlier attempt's outcome is then still unknown.
   * Use a new key for every new user action, even when the inputs are identical.
   *
   * A key makes the call strictly gasless: it never takes the wallet path and never falls back to
   * it, whatever the chain's `execution` defaults say. Combining it with `enabled: false` or
   * `fallback: "wallet"` throws `GASLESS_IDEMPOTENCY_KEY_INVALID` before any prompt. Decide the
   * wallet path yourself with {@link isConfirmedGaslessRefusalError}.
   *
   * Omitted, the SDK creates one key per call, as before.
   *
   * @example
   * ```ts
   * const key = generateGaslessIdempotencyKey();
   * await pendingActions.save({ key, ...recoveryContext });
   * await createSubAccounts(config, { ...inputs, gasless: { account: payer, idempotencyKey: key } });
   * ```
   */
  idempotencyKey?: string;
}
````

### `GaslessIdempotencyKeyParameter`

A shared mixin, added to `RelayGaslessBatchParameters`, `GaslessWalletExecuteParameters` and `RelayGrantDelegationParameters`. `RelayInstantOperationsParameters` and both `SettleGaslessDeposit*Parameters` already have the same field and adopt the mixin. For those three, only the documented meaning changes, from "one key per signature" to "one key per user action".

```ts
/**
 * Optional caller-owned idempotency key for a gasless submit. Same contract as
 * {@link GaslessWriteOptions.idempotencyKey}. Omitted, one key is generated per call.
 */
export interface GaslessIdempotencyKeyParameter {
  /** Your key for one user action: 1–128 characters, from {@link generateGaslessIdempotencyKey}. */
  idempotencyKey?: string;
}
```

### `generateGaslessIdempotencyKey`

It is internal today (`gasless/http.ts`). This slice exports it.

````ts
/**
 * Create a key for one user action: a random UUID (122 random bits).
 *
 * You may put your own readable label in front (`${flow}:${key}`), keeping the total at most
 * 128 characters. Never build a key only from the action's inputs, never reuse one for another
 * action, and never put secrets or personal data in it: the service stores the key and returns
 * it in status responses.
 *
 * @returns A new random key.
 * @example
 * ```ts
 * const key = `create-subaccount:${generateGaslessIdempotencyKey()}`;
 * ```
 */
export function generateGaslessIdempotencyKey(): string;
````

### `getGaslessDeploymentKey`

New. It reuses the fingerprint the snapshot work already computed (`gaslessSubmitDeploymentKey`), now public. It needs no new dependency, because `ohash` is already one.

````ts
/**
 * A non-secret fingerprint of the gasless deployment a call goes to: chain, contracts version,
 * service URL, protocol instance, and the gasless, SYMMIO, AccountLayer and InstantLayer
 * addresses. An idempotency key protects an action only inside one deployment. Store this value
 * with a pending action and compare it before any retry: a different value means the retry would
 * go somewhere the key does not protect it. Reconcile instead.
 *
 * Credentials, headers and execution settings never take part.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id, and the service: `"operations"` (default) or `"deposits"`.
 * @returns A stable string for that deployment and service.
 * @example
 * ```ts
 * if (getGaslessDeploymentKey(config, { chainId }) !== action.deploymentKey) return reconcile(action);
 * ```
 */
export function getGaslessDeploymentKey(
  config: Config,
  parameters?: { chainId?: number; service?: GaslessService },
): string;
````

### `GASLESS_SIGNATURE_LIFETIME_SECONDS`

New. Every SDK call that signs a gasless operation now fixes the operation's deadline when the call starts, instead of after the nonce-lock wait. Today's three 20-minute literals become this one constant. Gasless-wallet operations keep their shorter 10-minute lifetime.

```ts
/**
 * The longest a signature made by an SDK gasless call stays valid: 20 minutes, counted from the
 * moment the call starts. An attempt started at `T` (seconds) can no longer execute once the
 * chain's latest block timestamp passes `T + GASLESS_SIGNATURE_LIFETIME_SECONDS`. Allow a minute
 * of margin for the time between recording `T` and making the call.
 */
export const GASLESS_SIGNATURE_LIFETIME_SECONDS = 1200;
```

### `isConfirmedGaslessRefusalError`

````ts
/**
 * Whether the service refused this submit before it could execute: the daily free quota, the
 * fee policy or allowance, or a confirmed outage before acceptance. It is the same rule the SDK
 * applies before its own automatic wallet fallback.
 *
 * It describes this submit only. If you retried a key, a refusal does not prove that an earlier
 * attempt under that key was refused, so never send a retried action through the wallet on
 * this answer.
 *
 * @param error - Anything a gasless write or relay threw, including a React-wrapped error.
 * @returns `true` when this submit did not and will not execute.
 * @example
 * ```ts
 * if (isFirstAttempt && isConfirmedGaslessRefusalError(error)) {
 *   await createSubAccounts(config, { ...inputs, gasless: false });
 * }
 * ```
 */
export function isConfirmedGaslessRefusalError(error: unknown): boolean;
````

### `isGaslessRequestRejectedOrRevertedError`

Renamed from revision 1's `isGaslessRequestFailedError`, and narrowed.

````ts
/**
 * Whether a gasless request was accepted and then ended without any on-chain effect. That means
 * `rejected` (refused by the service's worker before broadcast) or `reverted` (mined and
 * reverted, with every operation and fee rolled back). The service does not try it again, so the
 * action under its key did not happen.
 *
 * A `failed` request is deliberately excluded: the service lost track of it, and its transaction
 * may still mine. Treat it as unresolved.
 *
 * @param error - Anything a gasless write, relay or confirmation threw, including a React-wrapped error.
 * @returns `true` when the error's code is `GASLESS_RELAY_REJECTED` or `GASLESS_RELAY_REVERTED`
 *   and the request record it carries, when present, has the matching status.
 * @example
 * ```ts
 * if (isGaslessRequestRejectedOrRevertedError(error)) await pendingActions.remove(key);
 * ```
 */
export function isGaslessRequestRejectedOrRevertedError(error: unknown): boolean;
````

### `isGaslessIdempotencyConflictError` (documentation only)

This export already exists; only its JSDoc changes. It used to say "a client bug: mint a fresh key". It will say: an earlier attempt of this action holds the key, and its outcome is unknown. Do not send the action again, not even through the wallet. Keep it pending and reconcile it.

### New error code

`GASLESS_IDEMPOTENCY_KEY_INVALID` (`SymmError`, kind `"validation"`). It is thrown before any prompt when a key is empty, is longer than 128 characters, or is combined with `enabled: false` or `fallback: "wallet"`.

### Removed (never published)

| Package | Removed                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core    | `CreateConfigParameters.writeRecovery`, `Config.writeRecovery`                                                                                                                                                                                                                                                               |
| core    | `GaslessWriteRecoveryAdapter`, `GaslessWriteRecoveryContext`, `GaslessWriteRecoveryRecord`, `GaslessWriteRecoverySession`                                                                                                                                                                                                    |
| core    | `SymmioGaslessConfig.beforeSubmit`, `GaslessSubmitSnapshot`, the snapshot input to `resubmitGaslessRequest`                                                                                                                                                                                                                  |
| core    | Error codes `GASLESS_SUBMIT_PERSISTENCE_FAILED`, `GASLESS_SUBMIT_CONTEXT_INVALID`, `GASLESS_RESUBMIT_DEPLOYMENT_MISMATCH`, `GASLESS_WRITE_BUSY`, `GASLESS_WRITE_RECOVERY_CONFLICT`, `GASLESS_WRITE_RECOVERY_INVALID`, `GASLESS_WRITE_RECOVERY_MISSING`, `GASLESS_WRITE_SIGNER_UNAVAILABLE`, `WRITE_TRANSACTION_UNSUCCESSFUL` |
| react   | The `SymmioProvider` prop `writeRecovery`                                                                                                                                                                                                                                                                                    |

## Behaviour

### Key rules

1. **One key per user action.** Reuse it for every attempt of that action. A new action gets a new key, even when the inputs are identical.
2. **Save it with the recovery context before calling.**
3. **Make it random.** Use `generateGaslessIdempotencyKey()`. A readable prefix is fine. Never derive a key only from the inputs: identical actions would merge into one, and anyone could predict the key.
4. **No secrets or personal data.** The service stores the key and returns it in every status response. It can also appear in logs and, later, in the lookup URL.
5. **At most 128 characters.**

### Recovery context

The consumer saves these fields before the first attempt, and keeps them up to date. All of it stays consumer-owned.

| Field                  | Why                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `key`                  | The action's identity at the service.                                                                                       |
| `chainId`              | An omitted chain id can resolve differently after a reload.                                                                 |
| `owner`                | The owner the action belongs to. It must still be the connected owner before anything is signed again.                      |
| `payer`                | The billing sub-account (`gasless.account`). It defines the nonce line.                                                     |
| resolved inputs        | Every write parameter, explicit, with no defaults, so a retry is the same action.                                           |
| `deploymentKey`        | `getGaslessDeploymentKey(config, { chainId })`. A retry on another deployment is not protected by the key.                  |
| `firstAttemptAt`       | Start of the retry window.                                                                                                  |
| `lastAttemptStartedAt` | Set before every call. With `GASLESS_SIGNATURE_LIFETIME_SECONDS`, it tells when no attempt can still execute.               |
| `requestId`            | Saved as soon as it is known: from the `accepted` event, `getGaslessWriteRequest`, or a React result's `gasless.requestId`. |
| `mayHaveSent`          | Whether an earlier call may have reached the service. It is what separates "fresh" from "retry".                            |

Before every retry, the consumer checks three things: the connected owner equals `owner`, `getGaslessDeploymentKey` still equals `deploymentKey`, and the call is inside the retry window. On any mismatch it reconciles and never signs again.

### Retry window

- **The window `W` runs from `firstAttemptAt`.** Proposed `W = 24 hours`, valid only once the service confirms at least 7 days of retention (see [Release gate](#release-gate-for-this-slice)). A retry at time `t` needs the key retained until at least `t + GASLESS_SIGNATURE_LIFETIME_SECONDS`.
- **Inside `W`:** an unresolved action may be retried with the same key.
- **Outside `W`:** never sign again. Reconcile.

### Reading an outcome

- **Fresh:** no earlier call with this key may have reached the service. Either the key is new, or every earlier call stopped before sending.
- **Retry:** an earlier call may have reached the service. A record that survives a reload is always a retry unless `mayHaveSent` is `false`.

| The call…                                                                                       | Fresh                                                                                                                                                                                                 | Retry                                                                  |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| returns                                                                                         | Core returns at broadcast: save the `requestId`, then `confirmGaslessRequest(..., until: "receipt")`. Remove the record only after the receipt succeeds. React's default result is already confirmed. | Same.                                                                  |
| throws `isGaslessRequestRejectedOrRevertedError`                                                | Final, with no effect. Remove the record.                                                                                                                                                             | Same: this call's own request was accepted, so no earlier attempt was. |
| throws `isConfirmedGaslessRefusalError`                                                         | Did not run. Remove the record. Whether to use the wallet path (`gasless: false`) is the consumer's choice.                                                                                           | Not proof: unresolved. Keep the record, and do not use the wallet.     |
| throws `isGaslessIdempotencyConflictError`                                                      | Unresolved: an earlier attempt holds the key. Keep the record and reconcile; do not retry.                                                                                                            | Same.                                                                  |
| stops before sending (prompt rejected, `GASLESS_SIGNER_NOT_DELEGATED`, validation)              | Nothing ran. Restore `mayHaveSent: false`. Then either retry with another signer under the same key, or remove the record.                                                                            | Unresolved: an earlier attempt may still run. Keep the record.         |
| throws anything else (`failed`, `GASLESS_SUBMIT_UNCONFIRMED`, timeouts, aborted waits, network) | Unresolved. Keep the record.                                                                                                                                                                          | Same.                                                                  |

### Resolving an unresolved action

1. **A `requestId` is known:** `confirmGaslessRequest(config, { chainId, requestId, until: "receipt" })`. This needs no signature.
   - Success means done.
   - Rejected or reverted means no effect.
   - `failed`, or no answer, goes to step 3.
2. **No `requestId`, inside the window, and the last answer was not a conflict:** the user may "Try again" with the same key, after the context checks.
3. **Otherwise, reconcile.**
   - Once the chain's latest block timestamp passes `lastAttemptStartedAt + GASLESS_SIGNATURE_LIFETIME_SECONDS`, plus a minute of margin, no attempt can still execute.
   - Check the action's own on-chain result. For account creation: does the new sub-account exist?
   - If it does, the action is done. If it does not, the action did not happen.
   - Remove the record either way, and tell the user.

Deposit settlements carry no signature deadline. Their outcome is bounded by the deposit wallet's balance instead.

### Nonce streams and same-key retries

- A keyed submit records its key along with its pending nonce.
- **Same key, unconfirmed pending submit:** the next attempt does not wait. It signs from the current on-chain nonce and resends under the key, and the service accepts only one of the two.
- **Same key, accepted pending submit (`requestId` known):** the next attempt follows that request without signing.
- **Different keys on one billing account** keep today's serialization. The second waits for the first, then throws `GASLESS_NONCE_STREAM_BUSY` after two minutes.
- A keyed acceptance never raises the stream's consumed-nonce floor. The service may answer with the earlier request, whose nonce differs from the one just signed.
- After a reload, these in-memory records are gone. A retry signs from the on-chain nonce, which also fills the gap a lost request left.

### Unchanged

- Without a key, every write behaves as it does at HEAD: the SDK mints a key per call and applies `fallback` as configured.
- Transparent writes return the hash after broadcast. That again includes `createSubAccounts`. React write hooks still wait for the receipt by default.
- When a transport failure is ambiguous, the SDK resends once, with the same key.
- `getGaslessUnconfirmedSubmit` and `resubmitGaslessRequest` remain for replaying the exact bytes of a submit.

## Internal modules

### New

- `gasless/idempotency-key.ts` (with a test file) holds two functions. Every submit entry point calls the resolver before any prompt.
  - `generateGaslessIdempotencyKey()`, moved here from `http.ts`.
  - `resolveGaslessIdempotencyKey(key?: string): string`. It returns the validated caller key, or a new one, and throws `GASLESS_IDEMPOTENCY_KEY_INVALID`.
- `gasless/deployment-key.ts` (with a test file): `getGaslessDeploymentKey`, moved out of the deleted `submit-snapshot.ts`.

### Changed

**core:**

- `shared/types/properties.ts`: the option and `GaslessIdempotencyKeyParameter`. The "there is deliberately no `idempotencyKey`" remark goes.
- `gasless/constants.ts`: `GASLESS_SIGNATURE_LIFETIME_SECONDS`, replacing the three 20-minute literals.
- `gasless/dispatch/resolve-gasless-write.ts`:
  - A key forces `enabled: true` and `fallback: "error"`.
  - Contradictory per-call options throw.
  - A keyed call never resolves to the wallet path: every branch that would return `null` throws instead.
- `gasless/dispatch/submit-gasless-write.ts`:
  - Sends the caller key.
  - Fixes the deadline at call start.
  - Follows a known same-key request without signing.
  - Applies the nonce rules above.
- `gasless/nonce-lock.ts`:
  - `GaslessPendingNonce` carries the submit's idempotency key.
  - `readGaslessStreamNonce` returns without waiting when the pending entry has the caller's key.
  - A lookup returns a same-key pending request id, so the caller can follow it.
  - A keyed acceptance does not raise the consumed-nonce floor.
- `gasless/relay-gasless-batch/`, `gasless/gasless-wallet-execute/`, `gasless/relay-grant-delegation/`: accept the key through the resolver, fix deadlines at call start, and follow the same nonce rules.
- `gasless/relay-instant-operations/`, `gasless/settle-gasless-deposit-new-account/`, `gasless/settle-gasless-deposit-existing-account/`: adopt the mixin and the validation; JSDoc wording.
- `gasless/fallback.ts`: `isConfirmedGaslessRefusalError`, which combines `isGaslessFreeQuotaExhaustedError`, `isConfirmedGaslessFeeLimitError` and `isConfirmedGaslessUnavailableError`.
- `gasless/errors.ts`: `isGaslessRequestRejectedOrRevertedError`.
- `gasless/unconfirmed-submit.ts`: the `isGaslessIdempotencyConflictError` JSDoc.
- `gasless/http.ts`: remove `beforeSubmit`, `afterSubmit`, `deploymentKey` and snapshot creation. Keep `getRequestHeaders` and the `replay` flag.
- `gasless/resubmit-gasless-request/resubmit-gasless-request.ts`: takes `GaslessUnconfirmedSubmit` only, with HEAD's validation, and keeps `replay: true`.
- `core/config/create-config.ts`, `core/chains/types.ts`, `core/config/merge-chain-config.ts`: remove `writeRecovery` and `beforeSubmit`.
- `transactions/execute-write.ts`, `transactions/execute-contract-write.ts`: remove the `recovery` capability.
- `symmio-contracts/account-layer/actions/create-sub-accounts.ts`: drop `recovery`. The JSDoc says it returns after broadcast and shows an example with a key.
- `src/index.ts`, `gasless/index.ts`: exports.

**react:**

- `provider/symmio-provider.tsx`: remove `writeRecovery`.
- `account-layer/use-create-sub-accounts.ts`: JSDoc.

### Deleted

- `gasless/write-recovery/context.ts`, `types.ts`, `execute-recoverable-write.ts` and `execute-recoverable-write.test.ts`.
- `gasless/submit-snapshot.ts` (its fingerprint moves to `deployment-key.ts`) and `gasless/submit-persistence.test.ts`.

### Kept from the working tree

These are unrelated to the recovery engine and stay unchanged:

- `SymmioGaslessConfig.getRequestHeaders` and `GaslessRequestContext`, for authenticated proxies.
- `DeepPartial` keeps function types, which `getRequestHeaders` needs in a partial chain config.
- A refused `resubmitGaslessRequest` stays `GASLESS_SUBMIT_UNCONFIRMED`, because an earlier attempt may have executed.
- Transparent relays send the billing sub-account as `accountId`. HEAD sent none.
- `useCreateSubAccounts` refreshes every owner's account lists, because the signer may not be wagmi's connected address.
- The `executeContractWrite` / `executeWrite` refactor, minus `recovery`.

### Tests

- **Keys:** generation, and validation (empty key, 129 characters).
- **Dispatcher:**
  - the caller key is in the POST body;
  - the ambiguous resend reuses it;
  - `enabled: false` or `fallback: "wallet"` with a key throws before any prompt;
  - with the chain default `execution.fallback: "wallet"`, a keyed call still never reaches the wallet;
  - non-relayable calldata with a key throws `GASLESS_NOT_RELAYABLE`;
  - the signed deadline equals call start plus the lifetime, even after a nonce-lock wait.
- **Nonce streams:**
  - a same-key retry after an unconfirmed submit signs at once, with no wait and no `GASLESS_NONCE_STREAM_BUSY`;
  - a same-key retry with an accepted pending request follows it without a prompt;
  - concurrent different keys on one billing account stay serialized;
  - an old request returned for a newly signed nonce leaves the floor alone;
  - with a lagging RPC, unkeyed and different-key writes keep today's floor behaviour.
- **`relay-gasless-batch`, `gasless-wallet-execute`, `relay-grant-delegation`:** key pass-through, validation, and deadline at call start.
- **Predicates:**
  - The refusal predicate is true for quota, fee-policy and confirmed-unavailable errors, and false for unconfirmed, conflict and non-billing terminal errors.
  - Rejected-or-reverted is true only for `rejected` and `reverted` records. It is false for `failed`, and false for a `GASLESS_RELAY_FAILED` code.
- **Deployment key:** stable for one config. It changes with chain, service URL, protocol instance and contract addresses, and ignores the API key and headers.
- **React** `transactions/write-hook-passthrough.test.tsx`: `gasless.idempotencyKey` reaches core, and `useRelayGaslessBatch` and `useGaslessWalletExecute` forward `idempotencyKey`.
- **Remove the snapshot and recovery cases** from `maybe-relay-as-gasless.test.ts`, `request-headers.test.ts` (keep "fresh headers on replay"), `resubmit-gasless-request.test.ts`, `transactions/execute-contract-write.test.ts`, `account-writes.gasless.test.ts` and `relayable-writes.test.ts`.
- **`scripts/verify-packages/published-smoke/core.ts`:** cover the new exports and a keyed `gasless` option.

### Release notes

- Delete `.changeset/persist-gasless-before-submit.md` and `.changeset/recover-named-account-writes.md`.
- Add `.changeset/gasless-idempotency-keys.md`, core minor:
  - the option and the mixin;
  - `generateGaslessIdempotencyKey`, `getGaslessDeploymentKey` and `GASLESS_SIGNATURE_LIFETIME_SECONDS`;
  - both predicates and the new error code;
  - same-key retries no longer wait on their own pending submit;
  - deadlines are fixed at call start.
- Add `.changeset/gasless-submit-fixes.md`:
  - core patch: a refused resubmit stays unconfirmed, and transparent relays send `accountId`;
  - react patch: account lists refresh for every owner.
- Move the `DeepPartial` note into `.changeset/authenticated-gasless-transport.md`.

### Completion checks

- `pnpm lint` and `pnpm check-types`.
- Core and react `pnpm test`. Use the react unit project only: its integration project broadcasts real transactions.
- The docs build.
- `pnpm verify-packages`.
- `pnpm format`.

## Package placement

- **core:** all the logic. The key, the deployment fingerprint and the signature lifetime are protocol facts. Validation, refusal and outcome classification are protocol rules. None of it needs framework state.
- **react:** no new API. Hooks forward their variables (a repository rule), so the only changes are the prop removal and pass-through tests.
- **ui, web:** nothing. No app in this repository uses the removed APIs.
- **Consumers:** the pending-action store, the recovery context, retries, reconciliation, UI, locks, signer order and the wallet-fallback decision.

## Docs impact (`apps/docs`)

**Remove:**

- Delete `core/gasless/submit-persistence/` and `core/gasless/write-recovery/`, and update `core/gasless/_meta.ts`.

**New pages:**

- `core/gasless/recovering-writes/page.mdx`, "Recovering gasless writes", under _Request lifecycle_. It covers:
  - the key rules and the recovery context;
  - the retry window;
  - the outcome table;
  - resolving an unresolved action: confirm by request id, retry, or reconcile after the signature lifetime;
  - same-key retries and nonce streams;
  - the note on deposit settlements;
  - the current limitation: an acceptance whose response was lost can be retried but not yet tracked;
  - a create-sub-account example.
- `core/gasless/generate-gasless-idempotency-key/page.mdx` and `core/gasless/get-gasless-deployment-key/page.mdx`: reference subpages under _Helpers_, one per method.
- `core/gasless/authenticated-proxies/page.mdx`, under _Config_. The `getRequestHeaders` documentation moves here from the deleted page. Fix its links in `core/gasless/page.mdx` and `core/shared-types/page.mdx`.

**Gasless pages:**

- `core/gasless/errors-and-fallback/page.mdx`:
  - Rewrite § Idempotency keys: every submit takes your key, one key per user action, and a `409` means unresolved. The "minted per call" table goes.
  - Remove the `beforeSubmit` paragraph.
  - § When the outcome is unknown points to the guide, and keeps `resubmitGaslessRequest` as the exact-bytes alternative.
  - Document both predicates in § The fallback safety rule and § Classifying a failure, and add `GASLESS_IDEMPOTENCY_KEY_INVALID` to § SDK error codes.
- `core/gasless/relayable-writes/page.mdx`: the `gasless.idempotencyKey` property and `GASLESS_SIGNATURE_LIFETIME_SECONDS`.
- `core/gasless/relay-gasless-batch`, `gasless-wallet-execute`, `relay-grant-delegation`: an `idempotencyKey` property, and the deadline at call start.
- `core/gasless/relay-instant-operations`, `settle-gasless-deposit-new-account`, `settle-gasless-deposit-existing-account`: reword the key, and remove the `beforeSubmit` paragraph.
- `core/gasless/page.mdx`, `react/gasless/page.mdx`: remove the `beforeSubmit` paragraph and link the guide.
- `core/gasless/resubmit-gasless-request/page.mdx`: `GaslessUnconfirmedSubmit` only. Keep "a refused replay stays unconfirmed", and point to the guide.

**Other pages:**

- `core/account-layer/create-sub-accounts/page.mdx`: remove the write-recovery section; it returns after broadcast; add a key example.
- `core/concepts/config/page.mdx`: remove § Named-write recovery.
- `core/shared-types/page.mdx`: the `DeepPartial` note keeps only `getRequestHeaders`.
- `core/symmio-contract/execute-account-calls/page.mdx`: fix the § Execution and recovery link.
- `react/account-layer/page.mdx`: replace § Account-creation recovery with a pointer to the guide, and keep the cache-ownership note.
- `react/provider/page.mdx`: remove the `writeRecovery` prop.

**Outside `apps/docs`:** in `packages/trading-core/ARCHITECTURE.md` §9, drop the write-recovery bullet and "optional recovery". Describe how a key flows through `resolve-gasless-write.ts`, `submit-gasless-write.ts` and `nonce-lock.ts`.

## Out of scope

- Lookup by key, and everything that needs it (see [Next slice](#next-slice-lookup-by-key)).
- SDK-side storage, locks, retry loops, reconciliation or a pending-action store.
- Flow-specific on-chain checks used in reconciliation. They belong to the consumer.
- The consumer-app migration, which is a separate repository: create-sub-account first, then the six journaled flows move from `beforeSubmit` to keys, preserving the existing deployment guards.
- Keys in `apps/web`.

## Backend dependency

### Release gate for this slice

These facts about today's service must be confirmed in writing by the backend team before this slice is released. No new endpoint is needed.

1. **Atomic key binding.** A key is bound to its request when the request is accepted, under a uniqueness guarantee. Concurrent submissions with one key can never both be accepted.
2. **A scope independent of the signer.** The key's scope (instance and service, plus the owner if keys are scoped per owner) does not change when a different signer (session key or owner) retries. The SDK already sends `userAddress` as the billing account's owner for every signer.
3. **Retention.** How long a bound key keeps answering with the existing record or `409`. The retry window must end at least one signature lifetime before retention does. Proposed: retention of at least 7 days, and a window of 24 hours.

### To verify on staging (not a gate)

- What a re-signed POST under an accepted key returns: `409`, or the existing record. Both are safe; the answer changes only the docs and messages.
- Whether a service refusal (fee policy, simulation) is decided before or after the key check.

### Agreed, pending (needed by the next slice)

1. **Two lookup endpoints:** `GET /v1/instances/{instance}/operations/by-idempotency-key/{key}` and `GET /v1/instances/{instance}/deposits/deposit-settlements/by-idempotency-key/{key}`.
   - `200` with the same body as the read by `request_id` (`OperationStatusResponse` / `DepositSettlementRecord`).
   - `404 NOT_FOUND` when the service has never seen the key.
   - For a key whose submit the service refused: `200` with `status: "rejected"`, `tx_hash: null`, and the refusal's `error_code` / `error_message`.
2. **The key is checked before simulation and fee checks.** Same key and same body: the existing record. Same key and a different body: `409` with `details.request_id` and `details.status`.
3. **A service verdict on a submit (fee policy, simulation) binds the key,** so a late copy of the original can never be accepted. Gateway rate limits, outages and authentication failures never reach the service and bind nothing.
4. **Consistency and retention:**
   - Read-after-write: once a POST returns, the lookup finds it.
   - The key mapping is committed before anything executes.
   - The retention from the release gate is documented.
   - Requests accepted before the endpoint shipped are covered, since they already store `idempotency_key`.
5. **Keys are scoped by a verified identity:** instance, service, and either the owner of the signed operations' account (checked on-chain) or the authenticated caller. Not the self-declared `userAddress`. A refusal caused by an invalid or unauthorized signature never binds a key in another owner's scope.
6. **Status responses include the original operations' account, `target` and `callData`.** Today `payload` is `{}`. With these fields, a client can verify that a request found under its key is its own action.
7. **Same access rules** as the read by `request_id`.

## Next slice: lookup by key

This comes after the backend ships, and it is additive (no breaking change):

- `getGaslessRequestByIdempotencyKey(config, { chainId?, idempotencyKey, service? }): Promise<GaslessRequest | null>`, with its query options and `useGaslessRequestByIdempotencyKey`.
- Keyed writes look the key up first and follow an existing request without signing. On a `409`, they follow `details.request_id`.
- Before following a request, the SDK checks that it is the same action: `user_address`, `account_id`, `operation_type`, and each operation's account, `target` and `callData`. Otherwise it throws `GASLESS_IDEMPOTENCY_KEY_REUSED`.
- Only a refusal the service recorded under the key (visible through the lookup as `rejected`) settles earlier uncertainty. Preflight refusals, gateway rate limits and outages never do.
- Reconciliation can then start with a lookup instead of an on-chain check.

## Decisions

### Settled (2026-10-19)

- **Option A:** a key makes a call strictly gasless. There is no silent wallet path and no automatic fallback, and contradictory options throw.
- The explicit relay actions (`relayGaslessBatch`, `gaslessWalletExecute`, `relayGrantDelegation`) are in this slice.
- Package placement as proposed.
- Removing the unpublished recovery engine and `gasless.beforeSubmit`.

### Open

1. **Names of the additions and the rename:** `getGaslessDeploymentKey`, `GASLESS_SIGNATURE_LIFETIME_SECONDS`, and `isGaslessRequestRejectedOrRevertedError` (formerly `isGaslessRequestFailedError`). The rest were accepted in revision 1.
2. **Retry window:** 24 hours, once the backend confirms at least 7 days of retention.
3. **Deadline at call start:** after a nonce-lock wait, the user has less time to sign. At least 18 of the 20 minutes remain.
4. **Release levels:** core minor, react patch.
5. **The release-gate answers from the backend.**

## Appendix A: consumer flow for create sub-account

`pendingActions`, `assertSameContext`, `stoppedBeforeSending`, `config` and `chainId` belong to the consumer. A React app makes the same calls. It can use `useCreateSubAccounts({ waitForReceipt: false })` to get `gasless.requestId` with the hash, or keep the default, which resolves only after the receipt.

```ts
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000; // valid once the service confirms at least 7 days of retention

interface PendingCreation {
  key: string;
  chainId: number;
  owner: Address;
  payer: Address;
  deploymentKey: string;
  write: { affiliate: Address; accountsData: readonly SubAccountCreationData[] };
  firstAttemptAt: number;
  lastAttemptStartedAt?: number;
  mayHaveSent: boolean;
  requestId?: string;
}

/** A new user action: a new key and its pinned context, saved before anything is signed. */
async function startCreation(owner: Address, payer: Address, write: PendingCreation["write"], from: Address) {
  const action: PendingCreation = {
    key: generateGaslessIdempotencyKey(),
    chainId,
    owner,
    payer,
    deploymentKey: getGaslessDeploymentKey(config, { chainId }),
    write,
    firstAttemptAt: Date.now(),
    mayHaveSent: false,
  };
  await pendingActions.save(action); // throws if storage is unavailable, so nothing is signed
  return attempt(action, from);
}

/** One attempt. The first call and every "Try again" go through here, with the same key. */
async function attempt(action: PendingCreation, from: Address) {
  assertSameContext(action, RETRY_WINDOW_MS); // owner, getGaslessDeploymentKey and the window still match
  const fresh = !action.mayHaveSent;
  const current = { ...action, mayHaveSent: true, lastAttemptStartedAt: Date.now() };
  await pendingActions.save(current);
  try {
    const hash = await createSubAccounts(config, {
      ...action.write,
      chainId: action.chainId,
      from,
      gasless: { account: action.payer, idempotencyKey: action.key },
    });
    const { requestId } = getGaslessWriteRequest(config, { hash })!;
    await pendingActions.save({ ...current, requestId }); // the tracking handle comes first
    await confirmGaslessRequest(config, { chainId: action.chainId, requestId, until: "receipt" });
    await pendingActions.remove(action.key); // only after a successful receipt
  } catch (error) {
    if (isGaslessRequestRejectedOrRevertedError(error)) return pendingActions.remove(action.key);
    if (fresh && isConfirmedGaslessRefusalError(error)) {
      await pendingActions.remove(action.key);
      return createSubAccounts(config, { ...action.write, chainId: action.chainId, gasless: false }); // the product's choice
    }
    if (fresh && stoppedBeforeSending(error)) await pendingActions.save(action); // nothing was sent: still fresh
    throw error; // anything else stays pending: see "Resolving an unresolved action"
  }
}
```

To save the request id even when the page closes during the broadcast wait, record it at acceptance. The chain config's `gasless.execution.onEvent` reports `{ type: "accepted", idempotencyKey, requestId }`; attach the request id to the record with that key.

After a reload, resolve each saved record as described in [Resolving an unresolved action](#resolving-an-unresolved-action):

1. With a `requestId`, confirm it.
2. Without one, inside the window, offer "Try again".
3. Otherwise, reconcile once the last attempt's signature lifetime has passed.
