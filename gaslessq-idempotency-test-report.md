# GaslessQ idempotency keys — staging test results

**Date:** 2026-10-20 (tests ran on 2026-10-19, 22:03–22:27 UTC)
**Service:** GaslessQ operations API, staging instance `arbitrum-42161-vibe-stage`
**Status:** every planned question is answered on staging; production is not checked yet

## Summary

GaslessQ deduplicates on the idempotency key alone. Once a key is bound to a request, every later submit under that key gets that same request back: HTTP `202`, the same `request_id`, and the request's current status. That holds whatever the new body contains and whatever state the request is in. The service never answered `409 IDEMPOTENCY_KEY_CONFLICT`.

That works for our gasless recovery design. A consumer only needs to store the key and the action's inputs. A retry signs again and resends under the same key. If an earlier attempt reached the service, the retry gets that request back, and nothing runs twice. We need no snapshot of the signed request and no lookup-by-key endpoint.

Key findings:

- **Same key → the earlier request**, even when the body changed, was signed again, carries an invalid signature, or names another user's `userAddress`. No `409`.
- **Binding is atomic.** 24 simultaneous same-key posts (5 rounds) always produced exactly one request. But 4 of those posts got a bare HTTP `500` instead of the existing request.
- **A key is used up once its request ends.** The key of a `failed` request kept returning that failed request, even with a new valid body.
- **A refused submit does not use up the key.** After a `400`, the corrected retry under the same key was accepted.
- **Keys are not scoped per user**, and they are kept at least 23 days.
- **Several SDK docs describe a `409` the service never sends.** They need fixing (see [Docs impact](#docs-impact)).

## Background

We are moving gasless recovery out of the SDK and into consumer apps, starting with Vibe-ui-v2:

- SDK writes behave as before.
- An app that wants recovery passes its own `gasless.idempotencyKey`, one per user action. It stores the key with the action's inputs and retries under the same key.
- The SDK only provides helpers:
  - `generateGaslessIdempotencyKey`
  - `getGaslessDeploymentKey`
  - `GASLESS_SIGNATURE_LIFETIME_SECONDS`
  - `isConfirmedGaslessRefusalError`
  - `isGaslessRequestRejectedOrRevertedError`

The full design is in `gasless-idempotency-keys-proposal.md`.

The backend declined to add a lookup-by-key endpoint: the key is only there for the frontend to know what happened.

A signed operation is never byte-identical between attempts: every signature has a random salt, a new deadline and the current nonce (details in [What changes between attempts](#what-changes-between-attempts)). So a retry always sends a **different body under the same key**. Whether that is safe depends on how the service treats it. The backend doc and our API guideline ("13. Idempotency") describe that differently.

Questions we needed answered:

1. Same key, body signed again: does the service return the existing request, a `409`, or create a new request?
2. Is a key scoped to the user, or global?
3. Is key binding atomic when the same key arrives several times at once?
4. What does the same key return while the first request is still pending, and after it failed?
5. How long are keys kept?

## Environment

| Item                | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Relayer base URL    | `https://gaslessq-staging.symmio.foundation/v1/instances/arbitrum-42161-vibe-stage/operations` |
| Endpoint under test | `POST /gateway/relay-instant`                                                                  |
| Chain               | Arbitrum One (42161), SYMMIO staging contracts (`apps/web/src/config/symmio-presets.ts`)       |
| GaslessLayer        | `0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca`                                                   |
| InstantLayer        | `0x89d1e2a9d2429722f756edffad149d7947b672ff`                                                   |
| AccountLayer        | `0x5733107211B2801Acd39933a54d482FE303c4907`                                                   |
| Test wallet         | `0x0AF32c77e9431c8a618E821a719A5cdA9D703F67` (the E2E test wallet, `E2E_SEED_PHRASE`)          |
| Test sub-account    | `0x4c4dfceb162438adbB54546AE8e60f52b0E76f7A`                                                   |

## How we tested

### Pass 1 — replaying stored requests (free)

The status endpoint returns each request's full original payload. We took stored staging requests that had already succeeded and whose signed deadline had passed hours or weeks earlier. We sent them again, changing one thing at a time.

Nothing was signed, and nothing could execute. Every replayed operation has an expired deadline and an already-used nonce, so the chain rejects it whatever the service does. The stored request was unchanged afterwards.

### Pass 2 — live requests

We funded the test sub-account with 1 USDC and an operational-fee allowance for the staging GaslessLayer. Staging charges 0.05 USDC per executed operation. Then we sent real relays.

Every operation was `editAccountName` on the test sub-account: harmless, and the name was restored at the end. Each body was built and signed exactly like the SDK's own relayed write. The pass executed 11 operations (0.55 USDC in fees); 0.45 USDC remains on the sub-account.

## Results

### 1. Same key, changed body (replay)

Base request `bea3b7f3-3b19-458d-b8bc-504be31d4007`: a `grantDelegation` from 2026-10-19 10:30 UTC, `succeeded`, signed deadline 10:50 UTC.

| #   | Sent                                                             | Answer              |
| --- | ---------------------------------------------------------------- | ------------------- |
| R1  | Same key, exact original body                                    | `202`, base request |
| R2  | Same key, `metadata` changed (not part of the payload hash)      | `202`, base request |
| R3  | Same key, `operationType` changed (in the hash, not signed)      | `202`, base request |
| R4  | Same key, `accountId` changed (in the hash, not signed)          | `202`, base request |
| R5  | Same key, salt changed without signing again (invalid signature) | `202`, base request |
| R6  | Same key, `userAddress` set to another wallet                    | `202`, base request |
| R7  | Exact original body, no key                                      | `202`, base request |
| R8  | Exact original body, a new key                                   | `202`, base request |

R5 shows the key is looked up before the signature check and the simulation. R1 shows the same: that body could no longer pass simulation.

### 2. Retention (replay)

| Request                                | Age       | Same key, exact body | No key, exact body  |
| -------------------------------------- | --------- | -------------------- | ------------------- |
| `159640e4-0c6e-4e2a-bab3-0fd13f099a86` | 9.4 days  | `202`, that request  | `202`, that request |
| `e02c3a23-bcfb-45d5-9580-4be4abbbdde6` | 16.4 days | `202`, that request  | `202`, that request |
| `8b292e2e-2bd6-4ae0-9026-f498e47e4c62` | 23.6 days | `202`, that request  | `202`, that request |

### 3. Same key while the first request is pending (live)

| Step | Sent                                                                 | Answer                                   |
| ---- | -------------------------------------------------------------------- | ---------------------------------------- |
| T1.1 | First submit under key K                                             | `202`, new request `8365ba42…`, `queued` |
| T1.2 | Same key, body signed again (same nonce, new salt, a different name) | `202`, request `8365ba42…`, `submitted`  |
| T1.3 | Same key, exact bytes of T1.1                                        | `202`, request `8365ba42…`, `submitted`  |

Only T1.1 ran: the request succeeded, and the sub-account got T1.1's name.

### 4. Same key at the same instant (live)

Each round sent several posts in parallel under one key. Every body was valid on its own (same nonce, different salt and name). If binding were not atomic, a round would produce more than one request id.

| Round | Posts              | `202`, same request | HTTP `500` | Requests created |
| ----- | ------------------ | ------------------- | ---------- | ---------------- |
| T2a   | 4 different bodies | 4                   | 0          | 1                |
| T2b   | 4 different bodies | 3                   | 1          | 1                |
| T2c   | 4 identical bodies | 4                   | 0          | 1                |
| T2d   | 6 different bodies | 5                   | 1          | 1                |
| T2e   | 6 different bodies | 4                   | 2          | 1                |

The `500` body was the plain text `Internal Server Error`, most likely the losing insert of the race. Each round's single request succeeded.

### 5. Key of a failed request (live)

To get a failed request, we sent two bodies with the **same nonce under two different keys**:

- **Sent about 200 ms apart:** the second was refused at submit (`400 SIMULATION_REVERTED`). No request was created.
- **Sent at the same instant:** both were accepted.
  - One succeeded.
  - The other ended `failed` with `CHAIN_EXECUTION_ERROR` ("execution reverted") and no transaction. It ended `failed`, not `rejected`.

We then sent a **new, valid body under the failed request's key**. The answer was `202` with the **failed** request; the new body did not run.

We could not produce a `rejected` or `reverted` request. Since the key lookup ignored status in every other case, we expect the same for those.

### 6. Key of a refused submit (live)

| Step | Sent                               | Answer                                        |
| ---- | ---------------------------------- | --------------------------------------------- |
| T4.1 | Body with a nonce gap, under key K | `400 SIMULATION_REVERTED`, no request created |
| T4.2 | Valid body, same key K             | `202`, new request `0783e5d2…`, succeeded     |

### Other observations

- A dedup answer looks exactly like a fresh accept: `{ request_id, status, paid_fee, remaining_fee_allowance }`. Only `status`, the stored request's current state, hints that the request is not new. No `Retry-After` header was sent.
- Staging charges the operational fee on-chain: 0.05 USDC per executed operation. The paying account needs a Core balance and a fee allowance for the staging GaslessLayer. As the backend doc says, `remaining_fee_allowance` comes back as the max-uint sentinel on staging.

## Compared with the documentation

### GaslessQ backend doc

From `Vibe-ui-v2/docs/handbook/design-docs/GaslessQ-BE.md`, operations section "Idempotency" (lines 888–898):

| The doc says                                                                                                                                                                 | Observed                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The same key again returns the existing record and publishes no duplicate work                                                                                               | Yes, whatever the new body, its signature, its `userAddress` or the request's status |
| The same payload without the key returns the existing record                                                                                                                 | Yes, also under a different key                                                      |
| The payload hash covers `userAddress`, `accountId`, `operationType`, `templateId`, `signedOps`, `signatures`, `fills`, `flexFillerSignatures`, and not the key or `metadata` | Consistent with what we saw                                                          |
| If calldata, signatures, … change, generate a new key                                                                                                                        | Required: a changed body never runs under an old key                                 |

The doc doesn't say:

- that keys are global, not per user;
- how long keys are kept;
- that a same-key race can answer `500`;
- that a refused submit leaves the key free;
- that a failed request keeps its key.

### API guideline "13. Idempotency"

| Guideline rule                                                                          | GaslessQ on staging                                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Mutations that clients may retry support idempotency                                    | Yes                                                                                    |
| Same key + same payload → the existing result                                           | Yes                                                                                    |
| Same key + conflicting payload → `409`                                                  | **No.** It returns the existing result (`202`)                                         |
| Keys scoped to the authenticated subject                                                | **No.** Keys are global. The API is anonymous, and `userAddress` is not used for scope |
| The same key from another subject must not collide with or replay its operation         | **No.** Another `userAddress` gets the existing request                                |
| Keys stored durably when the operation changes persistent state                         | Yes, at least 23 days                                                                  |
| The stored record holds the operation, subject, key, payload hash, status and result id | Yes, as far as the status record shows                                                 |

The guideline's `409` rule would **break** key-only recovery. A retry signed again would get a `409` instead of the request, and the client would lose track of it. If the backend ever adopts that rule, the `409` body must include the existing `request_id`.

## What changes between attempts

Every signed gasless write gets a random part on each call. The two deposit settlements have none.

| Call                                                                                     | What changes on each call                                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Relayable writes with `gasless` (`addMargin`, `createSubAccounts`, `editAccountName`, …) | Random 32-byte salt, deadline (now + 20 min), nonce read from the chain, and therefore the signature |
| `relayGaslessBatch`                                                                      | A random salt per operation, the deadline (now + 20 min), the nonces                                 |
| `relayGrantDelegation`                                                                   | Random salt, deadline (now + 20 min), nonce                                                          |
| `gaslessWalletExecute`                                                                   | Random salt, deadline (now + 10 min), the wallet's nonce                                             |
| `relayInstantOperations`                                                                 | Only what the caller signed. `buildSignedOperation` adds a random salt unless a `salt` is passed     |
| `settleGaslessDepositNewAccount` / `settleGaslessDepositExistingAccount`                 | Nothing. There is no signature, salt, deadline or nonce: the body is the inputs plus the key         |
| `resubmitGaslessRequest`                                                                 | Nothing. It resends the recorded bytes                                                               |

- **The key is random only when the SDK makes it.** If none is passed, each call gets a new UUID. With the app's own key, retrying a settlement with the same inputs sends exactly the same bytes.
- **The signature adds no randomness of its own.** viem signs deterministically, so a signature changes only when the salt, deadline or nonce changes.
- **So for signed writes, the key is the only thing that ties attempts together.** A settlement retry is an exact copy, but the deposit service was not part of this test.

### What the deadline does

The deadline is an expiry time signed into every operation, next to the nonce and the salt. The contracts refuse to run the operation once block time passes it. In perps-core v0.8.6 the checks are in:

- `ExecutionFacet.sol:163`, for normal operations;
- `DelegationFacet.sol:33`, for delegation grants;
- `GaslessWalletExecutionLib.sol:174`, for gasless-wallet operations.

It does two jobs:

- **It stops a signature from running late.** The nonce stops an operation from running twice, but not from running much later. Signed operations are visible to the relayer, and to anyone holding the request id: the status endpoint returns the full payload.
- **It gives recovery a finish line.** Once block time passes the last attempt's deadline, nothing signed for the action can still run. That is when an app can check the chain and settle an unresolved action, and when a `failed` request becomes final.

Gotchas:

- **A deadline of `0` never expires.** All three checks skip it. The SDK always sets a deadline, but an operation built by hand for `relayInstantOperations` could carry `0`, and then no amount of waiting settles it.
- **The backend doc's examples sign `4102444800`**, which is the year 2100 and effectively never expires.
- **The deadline is not a delegation's `expiryTimestamp`.** That one sets how long a session key's permission lasts. The deadline on the grant operation only limits when the grant itself can run.

## What it means for us

### The design works as built

- **One key per user action, and every retry resends under it.** A retry signs again. If an earlier attempt reached the service, the retry gets that request back; otherwise the retry becomes the request. Nothing runs twice, even under simultaneous submits.
- **A retry is also the lookup by key.** It costs a signature: silent for a session key, a wallet prompt for the owner.
- **No snapshot of signed bytes and no lookup endpoint are needed.**
- **The proposal's release-gate items hold on staging:**
  - key binding is atomic;
  - the key scope does not depend on the signer, because keys are global;
  - keys are kept at least 23 days, against a 24-hour retry window.

  Production is not verified yet.

- **The race `500` recovers by itself.** The SDK treats a `5xx` on submit as "may have been accepted" and resends once under the same key.

### Rules for consumers

- **Make keys unique across all users.** Keys are global to the deployment. Use `generateGaslessIdempotencyKey()` (a random UUID), optionally with a readable prefix. A key like `wallet-exit-1`, the backend doc's own example, would collide between users.
- **Never reuse a key for a different action.** The service ignores the new body and returns the old request, possibly `succeeded`, so the app would report success for an action that never ran. If the user changes the inputs, that is a new action with a new key.
- **A key is used up once its request ends.** After `failed`, `rejected` or `reverted`, the same key keeps returning that result. Trying again is a new action with a new key. After `failed`, try again only once on-chain reconciliation shows it did not run.
- **A `5xx` on submit means "maybe accepted", not "failed".** Resend under the same key. The SDK does this itself; code that calls the API directly must do the same.
- **Don't build UX on `409 IDEMPOTENCY_KEY_CONFLICT`.** The service doesn't send it. Keep any handling only as a safeguard.
- **Always sign a near deadline.** Operations built by hand for `relayInstantOperations` need a deadline minutes away, like the SDK's 20 minutes. With `0` or a far-future deadline, an unresolved action can never be settled by waiting.

## Docs impact

### SDK docs that are now wrong

| Where                                                                                                                                                                                  | Says today                                                                                                                                                                                           | Change to                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/trading-core/src/gasless/relay-instant-operations/relay-instant-operations.ts` (JSDoc) and `apps/docs/app/core/gasless/relay-instant-operations/page.mdx` (`idempotencyKey`) | "a service that already accepted the key answers `409 IDEMPOTENCY_KEY_CONFLICT`"                                                                                                                     | Any later submit under the key, same bytes or signed again, returns the request the key is bound to (`202`, same `request_id`) and runs nothing                                               |
| `packages/trading-core/src/shared/types/properties.ts` (`GaslessWriteOptions.idempotencyKey`)                                                                                          | A repeat "either follows that request or throws `409`", and the outcome then stays unknown                                                                                                           | A repeat follows the earlier request and returns (or throws) its outcome                                                                                                                      |
| `apps/docs/app/core/gasless/errors-and-fallback/page.mdx` (submit matrix, key rules, `classifyGaslessFailure` table, error-code table)                                                 | The `409` as a real outcome: "an earlier attempt of this action holds the key… never send it again"                                                                                                  | Mark it as not sent by the current service and kept as a safeguard. State the "same key → earlier request" behaviour. Note that a submit `500` can be a same-key race, and the SDK resends it |
| `apps/docs/app/core/gasless/recovering-writes/page.mdx`                                                                                                                                | "…or is turned away while the earlier request stands"; the outcome table's conflict row; "the last answer was not a conflict"; Limitations: "a `409` leaves its outcome unknown until you reconcile" | The retry gets the earlier request back. Drop the conflict branch or mark it as a safeguard. A retry is the lookup. Add "a key is used up once its request ends"                              |
| `apps/docs/app/react/gasless/page.mdx` (paragraph on `isGaslessIdempotencyConflictError`)                                                                                              | "the key belongs to another workflow, so the action needs a fresh one". This also contradicts the core page, which says never to send the action again                                               | Align with the core docs: the current service doesn't send it; it is a safeguard                                                                                                              |
| `packages/trading-core/src/gasless/unconfirmed-submit.ts` (JSDoc of `isGaslessIdempotencyConflictError`)                                                                               | Presents the `409` as what an earlier attempt causes                                                                                                                                                 | Say that the current service answers with the earlier request instead                                                                                                                         |

In `recovering-writes`, the `rejected`/`reverted` row's "Retry" column gives the wrong reason ("this call's own request was accepted, so no earlier attempt was"). The answer can be the earlier attempt's request. The conclusion still holds (final, no effect), because a key has only one request.

### Missing from the SDK docs

- Keys are global to the deployment, not per user. This belongs in "Rules for a key" on `generate-gasless-idempotency-key`.
- A key is used up once its request ends, including `failed`. This belongs in `recovering-writes` and `errors-and-fallback`; `errors-and-fallback` already says that trying again after a terminal status is a new action.
- A refused submit (`4xx`) leaves the key free, so the corrected retry can reuse it. This belongs in the `recovering-writes` outcome table.
- `relayInstantOperations` should say that every operation needs a near deadline: `0` never expires, so an unresolved request could never be settled.

### Vibe-ui-v2

- `lib/trading/vibecaps/gaslessqRecovery.ts` maps an upstream `409 IDEMPOTENCY_KEY_CONFLICT` to a "key conflict" message.
- `app/api/gaslessq/_lib/proxy.test.ts` mocks an upstream `409` with `Retry-After: 4`.
- The service sends neither. Both are fine as a safeguard, but no UX should depend on them.
- The app's own local check, which raises `IDEMPOTENCY_KEY_CONFLICT` when a saved request differs from a new one, is a client-side guard and is not affected.

### Backend doc: suggested additions

- The same key returns the existing request, whatever the new body or the request's status.
- Keys are global per instance (or, better, scoped by `userAddress`).
- The retention period.
- A refused submit (`4xx`) creates no request and leaves the key free.
- Under a same-key race, the loser currently gets a `500`.
- Replace the `wallet-exit-1` example key with one that is unique across users.
- Replace the `4102444800` (year 2100) deadline in the examples with a short one. A signature that never expires can't be settled by waiting.

## Asks for the backend

1. **Confirm the dedup behaviour in writing.** Confirm that "same key returns the existing request" is intended and stable, for any body and any status, and add it to the doc. Our recovery flow depends on it.
2. **Fix the race answer.** Under a same-key race, return the existing request (`202`) instead of `500`.
3. **Settle the key scope.** Either scope keys by `userAddress`, or document that they are global.
4. **Confirm production.** Confirm production behaves the same, and state the retention period.
5. **If you ever adopt the guideline's `409`** for a conflicting payload:
   - include the existing `request_id` in the `409` body;
   - compare the action (target, calldata, account), not the signed envelope. Otherwise every retry signed again would get a `409`.

## Open decisions for our team

1. **Reused-key check in the SDK.** Without a `409`, a key reused for a different action is answered with the old request, silently.
   - **Option:** after a keyed submit, the SDK reads the request back (`GET /operations/{request_id}`) and checks that its target, function and account match what it sent. If they don't, it throws `GASLESS_IDEMPOTENCY_KEY_REUSED`.
   - **Cost:** one extra read per keyed submit.
   - **Constraint:** compare the function selector, not the full calldata, because some actions embed oracle signatures that change between retries.
2. **Production check.** The free replay method (Appendix B) can verify production without signing or spending anything.
3. **Vibe-ui-v2 migration.** Move its flows off the deleted `beforeSubmit` / `writeRecovery` APIs, starting with create-sub-account.
4. **Deadline guard.** `relayInstantOperations` takes operations the caller signed. It could reject a keyed call whose operations never expire (`deadline: 0`).
   - **Recommendation:** document it for now.
   - Add the check only if a consumer actually builds operations by hand.

## Appendix A — evidence

| Test                        | Request id                             | Outcome                          | Transaction                                                          |
| --------------------------- | -------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| R1–R8 (base request)        | `bea3b7f3-3b19-458d-b8bc-504be31d4007` | succeeded (2026-10-19)           | `0x6d2de785a3cb79c05d1838655a59374520ed07c8226ee3e7747fe051235abd36` |
| Retention, 9.4 days         | `159640e4-0c6e-4e2a-bab3-0fd13f099a86` | succeeded (2026-10-10)           | `0x4cea0ff3551b81334d0f4f647cbf23ba787c6fc0f5bcacfca74d92b90ba2191f` |
| Retention, 16.4 days        | `e02c3a23-bcfb-45d5-9580-4be4abbbdde6` | succeeded (2026-10-03)           | `0x72f7c4ea3454a01f435c342f5beb7b34b3d3dc2b9d3f55b834db366bf22d3405` |
| Retention, 23.6 days        | `8b292e2e-2bd6-4ae0-9026-f498e47e4c62` | succeeded (2026-09-26)           | `0x02038cffc17ad3fce1075fca07d08e3bc04675ad8f684fe894ac9b0336188431` |
| T1                          | `8365ba42-6b5d-4507-a756-1304f82573a5` | succeeded                        | `0x00d4f91365abb943aa39ab2a7b90a75f379017f13fac8b316ad9a8913b484e0a` |
| T2a                         | `18fa3708-3307-4e0a-a441-7b2350e5cbd3` | succeeded                        | `0x8b03657ef544f82599b1908e08d9d3a118ceaf734dda97cc6988d54adb8a0853` |
| T2b                         | `cf906f7d-5516-4879-b197-30be5e842f31` | succeeded                        | `0xa6c1142f39905c8875d53ef38b89ea31475c5fefde41a4a4e9c89b0733a57d2c` |
| T2c                         | `e93cd45c-aecb-4c93-a56d-dd667a800d03` | succeeded                        | `0x969b3210a28c65c90f05a7014ad288ecce27a789ce118fedbb69021d00c78fc6` |
| T2d                         | `dfc1031a-80f6-4a1f-8c2a-3dfdeb3c0b7d` | succeeded                        | `0xaf4525e8d7470b69d53c3e8d878cac8a4c353b6c89eb763380ad3a737607677a` |
| T2e                         | `5ccdf2ff-fda1-4be5-af0d-8fc01077477b` | succeeded                        | `0x46fb43bffb4edf5903bc003d29215c590bc1c0abf3fadadf3018b6d61f853bdc` |
| Same nonce, ~200 ms apart   | `9273020b-ce70-4316-b99f-9e213fc8461b` | succeeded (the second got `400`) | `0x2ac8cd66bd58637be06e9f58c90fafdd07ec621fedc6d2745ea0066b6f85cbaf` |
| Same nonce, at once: winner | `f1261fb0-98c0-45c8-8dff-1d8ab63687c3` | succeeded                        | `0x33157e7e4b2010303ad6d8bc5962eb2ea2d78cedc08b0b8634731c93997c81b0` |
| Same nonce, at once: loser  | `ea97d799-3d1a-4016-8d4a-faff9951651d` | failed (`CHAIN_EXECUTION_ERROR`) | none                                                                 |
| T4                          | `0783e5d2-fd6b-410d-bae9-221c47bedc80` | succeeded                        | `0x6152a80ecd18ac026bb98f434d30bb306c3076165941667c9d2564fbb82cda7f` |
| Name restored (run 1)       | `00a9c086-462a-4c30-a2e3-86eb24632a2c` | succeeded                        | `0x6f008ac889345398e61c1003077ac8ac69850bcc95481a532c4a7e9f76ecb3fa` |
| Name restored (run 2)       | `2e74041b-7a46-4914-b5c0-f067b0f5dc55` | succeeded                        | `0xbba29e9156af934c51e6f2c116372adcf6ed786019288f459814a89d6854cb4a` |

The setup transactions were sent from the wallet:

| Step                                     | Transaction                                                          |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Approve 1 USDC to the staging core       | `0x02d0b64ae44fbbbfe8214062cc99717d61813408215045fe2827e40e725a5795` |
| Deposit 1 USDC into the test sub-account | `0xbd3de850affdd6291caeb038a6752c1ad29cabdac2e34a67c9e865a8d0e933c2` |
| Set the 1.0 fee allowance                | `0x85f91684e7f18ff79abf4c7d338d3ccfb281bacef5dcb2419eee0cfe2900c70d` |

## Appendix B — how to reproduce

**Free replay.** This needs no signing and costs nothing.

1. Find old relay transactions with `eth_getLogs` on the GaslessLayer address.
2. Call `GET /transactions/{tx_hash}` to get the `entity_id`. Skip anything with `workflow: deposit`; deposits are a different service.
3. Call `GET /operations/{entity_id}`. Its `payload` holds the full original request in snake_case.
4. Rebuild the camelCase request and `POST /gateway/relay-instant`, changing one thing at a time.

Only replay requests whose signed deadline is in the past, so that no variant can ever execute.

**Live.**

1. Sign `editAccountName(subAccount, name)` with the SDK's `buildSignedOperation` and `signSignedOperation`, using the staging preset in `apps/web/src/config/symmio-presets.ts`.
2. Post the same body that `relayInstantOperations` sends.
3. The paying account needs a Core balance and a fee allowance: 0.05 USDC per executed operation.
4. For races, open one connection per post first (any `GET`), then send all the posts with `Promise.all`.
