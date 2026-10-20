# SDK follow-ups — gasless idempotency keys

**Date:** 2026-10-20
**Branch:** `feat/sdk-account-features`, commit `fd24309c` (not pushed)
**Background:** `gasless-idempotency-keys-proposal.md` (the design) and `gaslessq-idempotency-test-report.md` (staging results)

The feature is implemented and committed: caller-owned idempotency keys, recovery owned by the consumer, and helpers in the SDK. The staging tests confirmed the design: the same key always returns the request it is bound to, so a retry can never run twice. This document lists what is still missing or worth improving in the SDK.

## Overview

| #   | Item                                                    | Priority                     | Design proposal |
| --- | ------------------------------------------------------- | ---------------------------- | --------------- |
| 1   | Correct the docs to match the measured service behavior | Before release               | No              |
| 2   | Verify the dedup behavior on production                 | Before release               | No              |
| 3   | Update the design proposal                              | Before release               | No              |
| 4   | Detect a key reused for a different action              | High                         | Yes             |
| 5   | Unit tests for the answers the service actually sends   | High                         | No              |
| 6   | Opt-in check of the service's dedup behavior            | Medium                       | No              |
| 7   | Helper that tells when an unresolved action can settle  | Medium                       | Yes             |
| 8   | Settle `failed` sooner when nothing was broadcast       | Low (needs a backend answer) | Yes             |
| 9   | Coordinate the nonce lock across tabs                   | Low                          | Yes             |
| 10  | Deadline guard for hand-built operations                | Low                          | Yes             |
| 11  | Check the deposit service's key behavior                | Low                          | No              |

"Design proposal: Yes" means the item changes the public API, so it goes through the Design Proposal Gate first.

## Before release

### 1. Correct the docs to match the measured service behavior

**Why.** Several docs pages and JSDoc comments say a retry that was signed again gets `409 IDEMPOTENCY_KEY_CONFLICT`. On staging, the service always answered with the earlier request (`202`). The React gasless page also contradicts the core page about what to do after a `409`.

**What.**

- Rewrite every `409` statement. The same key returns the request it is bound to, for any body and any status. Document `isGaslessIdempotencyConflictError` as a safeguard only. The exact places are in the "Docs impact" table of the test report.
- Add what is missing:
  - a key is used up once its request ends (`succeeded`, `failed`, `rejected` or `reverted`);
  - keys are global to the deployment, so a key must be unique across all users;
  - a refused submit (`4xx`) leaves the key free;
  - a `5xx` on submit can be a same-key race, and the SDK resends it;
  - every operation needs a near deadline, and a deadline of `0` never expires.

**Done when.** No page or JSDoc presents the `409` as an expected outcome, and the core and React pages agree. The docs build, lint and Prettier pass.

### 2. Verify the dedup behavior on production

**Why.** Every result so far comes from staging.

**What.**

- Run the free replay check (test report, Appendix B) against production. Cover the same key with a changed body, no key, and an old request's key. The check signs nothing, and nothing it sends can execute.
- Get the backend's written confirmation of:
  - the same key returns the existing request, for any body and status;
  - the key scope;
  - the retention period;
  - the `500` under a same-key race.

**Done when.** The production results and the backend's answers are recorded in the proposal's release gate.

### 3. Update the design proposal

**Why.** `gasless-idempotency-keys-proposal.md` still plans a "next slice: lookup by key". A retry under the same key already is the lookup.

**What.** Drop that plan, and record the measured facts and the release-gate status in the proposal.

**Done when.** The proposal matches the measured behavior and shows which release-gate items are confirmed.

## High

### 4. Detect a key reused for a different action

**Why.** The service never answers `409`. A key reused for another action returns the old request, and the SDK then reports that request's outcome. That can be a success for an action that never ran.

**What.**

- For a key the app passed, compare the request the service returns with what was sent: the number of operations, each operation's target, function selector and signer account, and the owner.
- On a mismatch, throw a new `GASLESS_IDEMPOTENCY_KEY_REUSED` instead of following the request.
- Compare function selectors, not full calldata: some actions embed oracle signatures that change between retries.
- Transparent writes already read the request while following it, so the check can reuse that read. Explicit relays (`relayGaslessBatch`, `relayInstantOperations`, …) need one extra read, or an exported helper that does it.

**Done when.**

- Given a key bound to request A, when a different action is sent under it, then the call throws `GASLESS_IDEMPOTENCY_KEY_REUSED` and never reports A's outcome.
- Given a retry of the same action, signed again, then the call follows A.

### 5. Unit tests for the answers the service actually sends

**Why.** Today's tests mock a `409` that the service never sends. Some answers it does send are not covered.

**What.** Add tests that mock what staging returned:

- **Earlier request succeeded.** A keyed retry is answered with an earlier request that already `succeeded`. The transparent write returns that request's transaction hash and submits nothing else.
- **Earlier request failed.** The call throws `GASLESS_RELAY_FAILED`, because the key is used up.
- **Race `500`.** A submit gets a `500`, then the resend gets a `202` with the existing request. The call succeeds.
- **Refused submit.** A submit is refused with `400`, then a retry under the same key is accepted as a new request.

**Done when.** Each case has a test, and breaking the behavior makes that test fail.

## Medium

### 6. Opt-in check of the service's dedup behavior

**Why.** Recovery depends on service behavior that is not in the backend's API spec. If the backend changes it, for example by adopting the API guideline's `409`, retries break without any change in the SDK.

**What.** A script outside the default test run that applies the free replay method to a configured deployment and checks the rules:

- the same key with a changed body returns the same request;
- no `409` comes back;
- old keys still return their request.

It never signs or spends. Run it before each release, or on a schedule.

**Done when.** One command reports pass or fail per rule for staging and production.

### 7. Helper that tells when an unresolved action can settle

**Why.** Before reconciling, every consumer must check chain time against `lastAttemptStartedAt + GASLESS_SIGNATURE_LIFETIME_SECONDS`, plus a margin. It has to be chain time, not the device clock, and that is easy to get wrong.

**What.**

- A core helper that reads the latest block timestamp and answers whether any attempt started at or before a given time could still execute. The margin is built in.
- A matching React hook.

**Done when.** The helper returns `false` before the bound and `true` after it, using block time, and the `recovering-writes` guide uses it instead of its hand-written check.

## Low

### 8. Settle `failed` sooner when nothing was broadcast

**Why.** In the tests, a same-nonce clash ended `failed` (`CHAIN_EXECUTION_ERROR`) with no transaction. The SDK treats every `failed` request as unresolved, so the app waits out the deadline, up to 20 minutes, before it can tell the user.

**What.** Ask the backend whether `failed` without a `tx_hash` guarantees that nothing was broadcast. If it does, add a predicate that treats that case as final.

**Done when.** The backend's answer is recorded. If the answer is yes, the predicate exists and the recovery guide uses it.

### 9. Coordinate the nonce lock across tabs

**Why.** The nonce lock serializes writes on one billing account only within one config, which means one page. If two tabs send different actions at once, they clash on the same nonce: one is refused (`400`) or ends `failed`. Nothing runs twice, but the user sees a confusing failure.

**What.** An optional lock hook in the gasless config, for example backed by the Web Locks API in browsers. The nonce stream uses it across contexts. The app injects the lock, so core stays framework-agnostic.

**Done when.** With the hook configured, two contexts writing to one account run one after the other.

### 10. Deadline guard for hand-built operations

**Why.** `relayInstantOperations` relays operations that the caller signed. An operation with `deadline: 0`, or a deadline far in the future, never expires, so waiting can never settle an unresolved request.

**What.** Start with the docs (item 1). Add a guard only if consumers actually build operations by hand: reject keyed calls whose operations have no deadline, or one beyond a maximum.

**Done when.** The decision is recorded. If the guard is built, a keyed call with `deadline: 0` throws before anything is submitted.

### 11. Check the deposit service's key behavior

**Why.** Settlements have no signature, salt or deadline, so a retry is an exact copy of the first attempt. But only the operations service was tested.

**What.** Using the test wallet, check the deposit service:

- whether the same key returns the existing settlement;
- what a different key with the same body does;
- what the key returns after the settlement ends.

**Done when.** The results are recorded, and the settlement docs are updated if they differ from the operations service.

## Outside the SDK

- **Backend.** The asks in the test report:
  - confirm the dedup behavior in writing;
  - return the existing request instead of a `500` when the same key arrives several times at once;
  - settle the key scope;
  - confirm production behavior and the retention period;
  - fix the `wallet-exit-1` example key and the year-2100 example deadline in their doc.
- **Vibe-ui-v2.**
  - Move its flows off the deleted `beforeSubmit` / `writeRecovery`, starting with create-sub-account.
  - Stop relying on an upstream `409`.
