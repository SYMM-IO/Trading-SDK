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
