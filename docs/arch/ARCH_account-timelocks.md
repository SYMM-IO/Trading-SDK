# Account timelocks — Architecture

## Overview

The framework-neutral core exposes AccountLayer policy, approval and delayed-execution
primitives. React adds receipt-aware hooks and cache invalidation. Public integration
guides live in `apps/docs/app/core/account-layer/timelocks/`.

## Key decisions

- Capability, approval transport and indexing observer are injectable. The standard
  adapter reads deployment metadata from `/info` without requiring every provider
  to implement that endpoint.
- Policy belongs to the resolved root; a Core execution wrapper retains the original
  account. The SDK derives all 22 policy selectors from its pinned contract ABIs.
- Approval issuance is single-use and never automatically retried. An execution
  failure after issuance retains the approval for consumer-owned reconciliation.
- Public approval expiry uses chain time, including a fresh read after issuance.
  Response validation or time-read failure retains the untrusted response for recovery;
  it never silently requests a replacement or executes an unchecked approval.
- Early-withdrawal React errors retain the underlying classification and the recovery
  wrapper together. Mined reverts keep their receipt and transaction-error subclass.
- Submission uses the shared gasless dispatcher. An omitted `gasless` option inherits
  execution configuration; explicit false selects wallet submission. Early withdrawal
  requires the owner execution signer independently of who pays gas.
- Confirmation and solver indexing are separate. An injected read-only observer can
  report indexing; absence of evidence returns `unknown`, never an approval probe.
- Instant-open margin approvals use their own wrapper and signature flex range, not
  the public approval endpoint. Prepared submission preserves signed bytes and salts.
- UI steps, persistent storage, automatic fallback selection and recovery policy stay
  with the consumer. Existing order-mutation retry defaults are not changed.
- Policy-change assessment stays in core: `getTimelockPolicyChange` reports weakening,
  exact setup bytes, current unlockers and the longest affected delay from a policy report.
  Setup reports a typed authorization error before wallet resolution unless the exact
  change already has a mature schedule. It never obtains approvals or schedules on its own.
- Public approval signatures are opaque, byte-aligned hex (EOA or EIP-1271), not always
  65 bytes. The contract checks validity. The instant-open placeholder remains 65 bytes.

## File map

- `packages/trading-core/src/timelock/`: provider, policy report/setup, typed errors,
  approval validation and early-withdrawal composition.
- `packages/trading-core/src/symmio-contracts/account-layer/actions/timelock.ts`:
  low-level contract reads, writes and schedule window calculation.
- `packages/trading-core/src/gasless/effective-instant-selectors.ts`:
  delegation checks use the immediate inner AccountLayer selector.
- `packages/trading-core/src/solvers/instant-open/instant-open/`: margin wrapper,
  prepare/sign and immutable submit flow for the Enigma adapter.
- `packages/trading-react/src/account-layer/use-timelock*.ts`: thin read/write hooks.

## Data flow

Capability + root policy reads → setup → receipt → indexing evidence.
Raw calldata → signed public request → one approval → wrapped execution → receipt.
Delayed path: schedule raw calldata hash → delay → execution or cancellation.
Instant margin: wrapper with zero signature placeholder → signed operation → solver fill.

## Dependencies

Pinned AccountLayer/Core/InstantLayer ABIs, injected viem clients, provider HTTP transport,
optional configured gasless service and TanStack Query bindings. No new dependencies.

## Edge cases and gotchas

- API acceptance and a transaction hash do not prove on-chain success.
- A timeout is not a rejection. Never switch submission routes after an unknown result
  without reconciliation; shared gasless fallback/idempotency rules remain authoritative.
- Timelock delay and Core withdrawal cooldown are independent.
- Raising a provider minimum requires a fresh policy check and explicit repair.
- Public approval validity does not cap instant-margin approval deadlines. Wrapped opens
  recheck quote, operation and approval deadlines after signing and before submission.
- Unit tests do not prove live relay support, contract deployment or solver indexing.

## React batch invalidation correction — 2026-10-27

Cache effects and delegation authority are different sets. The React batch hook
retains the core delegation selector helper, then inspects `executeTimelockOp`
and `_call` contents for cache effects only. It refreshes policy/selector/schedule
reads after setup or clear, schedule reads after schedule/cancel/execute, and the
existing domain reads for wrapped operations. Invalidation remains deployment-scoped.
No core API, signing, transport or confirmation timing changed in this correction.

### Regression evidence

Two existing test files extended; nine added cases passed. The broader gasless
and timelock hook run passed 71 tests in 14 files. Typecheck, changed-file ESLint,
Prettier and the React package build passed. The broad run logged a staging-host
DNS error from existing network setup; it is not live relay verification.

Source paths below are relative to `packages/trading-react/src/gasless/`.

| #   | Test name                                                                     | Source path / path covered                  | Assertion                                                                  | Result |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| 1   | refreshes root and inherited policy after setupTimelocks                      | `invalidate-relay-reads.ts` / policy write  | Root, VA policy and schedule stale; other deployment unchanged             | pass   |
| 2   | refreshes root and inherited policy after clearTimelocks                      | Same / clear policy                         | Policy and derived schedule refreshed                                      | pass   |
| 3   | refreshes only schedule data after scheduleTimelockOp                         | Same / schedule                             | Schedule stale, policy and withdrawal unchanged                            | pass   |
| 4   | refreshes only schedule data after cancelTimelockOp                           | Same / cancel                               | Schedule stale, policy and withdrawal unchanged                            | pass   |
| 5   | refreshes withdrawal reads inside a named timelock wrapper                    | Same / named wrapper → Core call            | Withdrawal and schedule refreshed, unrelated domains unchanged             | pass   |
| 6   | refreshes withdrawal reads inside a raw timelock wrapper                      | Same / raw wrapper → Core call              | Withdrawal and schedule refreshed, other deployment unchanged              | pass   |
| 7   | refreshes sub-account reads for a direct AccountLayer call inside the wrapper | Same / direct AccountLayer operation        | Account and schedule reads refreshed                                       | pass   |
| 8   | refreshes timelock policy only after observing successful execution           | `use-relay-gasless-batch.ts` / confirmation | Accepted pending request leaves policy fresh; observed success invalidates | pass   |
| 9   | does not refresh policy when confirmation fails without observed success      | Same / failure                              | Failure does not invalidate policy                                         | pass   |

Self-review: mechanical checks found only the pre-existing PublicClient test-stub
cast; no new type bypasses, snapshots, test IDs or trivial length checks. No dead
captures found. Each case covers one trigger; assertions would fail on skipped
wrapper traversal, premature invalidation or missing deployment scoping. Existing
non-timelock batch tests remain green. Live RPC/relay execution is out of scope.

## Direct execution cache parity

The direct `useExecuteTimelockOp` hook now shares domain invalidation with gasless
batches. `invalidateTimelockExecutionReads` traverses the inner operation and
refreshes its known domain reads only after confirmation. Direct wallet execution
does not invalidate relay nonce or fee state merely because it shares this helper.
The public APIs and core submission behavior are unchanged.

Protected sub-account deletion uses the existing approval/execution composition:
raw `deleteSubAccount` calldata is both approved and executed directly, without
a Core `_call` wrapper. Account lists, addresses, counts and details refresh on
success. This change does not enable a frontend deletion button or choose a
fallback policy. The unwrapped deletion action is unchanged.

### Direct execution regression report

One test file added, eight cases. The focused broader suite passes 79 tests across
15 files. Typechecking initially caught a test fixture using `account` instead of
the withdrawal query's `user` field; the fixture was corrected, without weakening
assertions. Live solver/RPC execution is not covered.

All rows exercise `packages/trading-react/src/account-layer/use-timelock.ts` through
its public hook and real core action, with viem read/simulate/write/receipt boundaries stubbed.

| #   | Test name                                                            | Code path covered         | What it asserts                                                                        | Status |
| --- | -------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- | ------ |
| 1   | refreshes deleted sub-account reads only in the confirmed deployment | confirmed direct deletion | Account and schedule caches refresh; unrelated deployment, nonce and withdrawal do not | pass   |
| 2   | refreshes withdrawal reads through the Core wrapper                  | `_call` traversal         | Withdrawal reads refresh, account lists do not                                         | pass   |
| 3   | does not refresh or repeat deletion after simulation                 | simulation rejects        | No submission or invalidation                                                          | pass   |
| 4   | does not refresh or repeat deletion after rejection                  | wallet rejects            | One submission attempt, no confirmation or invalidation                                | pass   |
| 5   | does not refresh or repeat deletion after revert                     | reverted receipt          | No retry or invalidation                                                               | pass   |
| 6   | does not refresh or repeat deletion after timeout                    | receipt timeout           | No retry or invalidation                                                               | pass   |
| 7   | does not refresh deletion reads when receipt waiting is disabled     | submission-only result    | No receipt wait or invalidation                                                        | pass   |
| 8   | waits for the deletion receipt before refreshing account reads       | pending → confirmed       | Account caches remain fresh until receipt resolves                                     | pass   |

Self-review: mechanical grep passed (no type bypasses, snapshots, test IDs,
tautological type/length assertions, or waitFor/getBy combinations). Dead-capture
review passed: fixture data feeds requests/assertions and the deferred resolver
drives the confirmation boundary. Mutation-by-imagination passed: skipping inner
traversal, invalidating before confirmation, dropping deployment scope, or enabling
mutation retries breaks the corresponding case. One-concept-per-test review passed;
the four independent failures use parameterized cases. No new dependencies or core
implementation changes were needed. Existing staging-host DNS logging in the broad
suite is not live relay verification.
