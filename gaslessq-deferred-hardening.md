# GasLessQ integration: deferred hardening

The GasLessQ release integration (plan `~/.claude/plans/we-want-to-integrate-shimmering-book.md`, specs S1–S12) deliberately leaves out the items below. This file gives a follow-up thread enough context to design and implement each one without redoing the analysis.

**Sources**

- The vendor release doc, "Chapter 2 — Frontend and API" (`frontend-integration.md`). Line numbers below refer to it.
- perps-core `version_0.8.6` at commit `b63ee55e4cfbbc6a9757d23212102d5572e5d829`:
  - `abis/gaslessLayer.json`, `abis/gaslessLayerWallet.json`
  - `contracts/gaslessLayer/GaslessLayer.sol`
  - `libraries/GaslessFeeQuoteLib.sol`, `GaslessOperationalFeeLib.sol`, `GaslessFeeLimits.sol`, `GaslessNativeGasTopUpLib.sol`
- Live read-only probes against the Arbitrum **staging** deployment on 2026-09-17:
  - gateway `https://gaslessq-staging.symmio.foundation`
  - GaslessLayer proxy `0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca`
  - implementation `0x640b404a0b2cC8D7F95b6356CC97e44639b91d64`
- Vibe-ui-v2 `origin/staging` (read-only reference app).

**Assumed baseline**

Code citations describe the repo **before** S1–S12. Each section has an "After S1–S12" note saying what the main plan already changes. The follow-up assumes S1–S12 have landed:

- the full latest ABIs;
- the `previewFeeQuote`-based `getGaslessFeeQuote`;
- `walletId` on reads, writes and `GaslessSignedOperationInput`;
- nonce stream keys;
- the typed error and fallback matrix;
- the status stream;
- the direct anonymous apps/web wiring.

Every item here that adds or changes public SDK API is still subject to the Design Proposal Gate (root `AGENTS.md`).

---

## Contents

1. [Health canary and GaslessLayer coherence checks](#1-health-canary-and-gaslesslayer-coherence-checks) — **not selected**
2. [Sign-without-submit helpers (atomic mixed batches)](#2-sign-without-submit-helpers-atomic-mixed-batches) — **not selected**
3. [Advisory affordability check](#3-advisory-affordability-check) — **not selected**
4. [Other deferred items](#4-other-deferred-items)
   - 4.1 Native gas top-up
   - 4.2 Partner-key WebSocket handshake headers
   - 4.3 GaslessLayer event decoders and historical ABIs
   - 4.4 `withdrawWalletFunds` wrapper
   - 4.5 `simulateFeeQuote` / `executeWithFeeLimit`
   - 4.6 Salt-encoded signed fee limits
   - 4.7 Cross-tab / cross-device nonce coordination
   - 4.8 Public `tx_hash` stream watcher and attempt-by-hash read
   - 4.9 `approveOperationalFee` overwrites the fee multiplier
5. [Suggested order](#5-suggested-order)

---

## 1. Health canary and GaslessLayer coherence checks

### Problem

Two related gaps both let a misconfigured deployment reach a signature prompt or a funds transfer.

**A. No way to canary an instance.**

- The doc wants every environment verified before use:
  - `GET {base}/health` returns the backend identity (lines 142, 154).
  - "Verify `X-GasLessQ-Protocol-Instance` equals the selected key on every successful canary" (line 919).
  - The release checklist asks to record and verify stage/production facts separately (927–930).
- The SDK has no health read: `grep -rn health packages/trading-core/src/gasless` is empty.
- apps/web `gasless-service-card.tsx` only renders static config.

**B. Coherence is checked in one place only.**

- The doc says: "Before signing or transferring collateral, verify the wallet chain and approved contract record match the selected instance" (76–78).
- It also says: read `collateralToken()` and the token's `decimals()` from the GaslessLayer, and transfer only that token (789–792).
- Today `assertGatewayCoherence` (`packages/trading-core/src/gasless/dispatch/maybe-relay-as-gasless.ts:96-139`) reads only `GaslessLayer.instantLayer()` and compares it with `addresses.instantLayerAddress`, throwing `GASLESS_CONFIG_INCOHERENT` on a mismatch. It runs **only** from the transparent dispatcher (`:279`).
- These actions never check coherence:
  - `getGaslessDepositPolicy` (`get-gasless-deposit-policy.ts:59-81`)
  - `getGaslessWalletAddress`
  - `gaslessWalletExecute` (`gasless-wallet-execute.ts:171-235`)
  - `relayGrantDelegation` (`relay-grant-delegation.ts:78-118`)
  - both settle actions
- The deposit policy never compares `collateralToken()` with `addresses.collateralAddress`.

**Why it matters (live facts):**

- The same owner gets **different** GaslessWallet addresses on different proxies. Owner `0x1111…1111`, wallet 0 is `0x50dD95cD…` on staging and `0x06727a27…` on production.
- If `gaslessLayerAddress` points at a different proxy than the one the configured gateway instance settles against, the app shows a deposit address that instance will never sweep. The user transfers collateral into a wallet the gateway does not serve.
- The same class of cross-wire already happened once in apps/web: the staging/production profile merge and the persisted-overrides blob pinning stale facts.

### What already exists / what S1–S12 cover

- **S1** maps an empty-data revert of `previewFeeQuote` to `GASLESS_LAYER_INTERFACE_UNSUPPORTED`. That detects a legacy (production) proxy, but only on the fee-quote path.
- **S3** asserts `X-GasLessQ-Protocol-Instance` on every 2xx HTTP response, including proxy roots when the header is present.
- **S4** adds `collateralDecimals` (the token's `decimals()`) to `getGaslessDepositPolicy`. **S11c** makes the web deposit card read the balance and decimals of `policy.collateralTokenAddress`.
- **Not covered:** a health read, and on-chain coherence (`instantLayer`, `accountLayer`, `core`, `collateralToken`) on the non-dispatcher actions.

### Live ground truth

- `GET https://gaslessq-staging.symmio.foundation/v1/instances/<protocol-instance>/operations/health` returns 200 with `{"status":"ok","service":"operation-api","protocol_instance":"<protocol-instance>","chain_id":"42161"}`. `/deposits/health` returns `"service":"deposit-api"`.
- Headers include `x-gaslessq-protocol-instance`, `x-gaslessq-service-name` and `x-gaslessq-gateway-service: auth-gateway`.
- An unknown instance returns 404 `{"error":"Unknown or disabled protocol instance: …"}` with **no** instance header.
- Staging proxy views:
  - `instantLayer()` = `0x38AaBc7A73523Cd47c710FcdEb3b20ae02310180`
  - `accountLayer()` = `0x5733107211B2801Acd39933a54d482FE303c4907`
  - `core()` = `0x573310dB6d160B26026B8706EBe9831c7dEF1D09`
  - `collateralToken()` = native USDC `0xaf88…5831`
  - All match `apps/web/src/config/symmio-presets.ts`.

### Proposed API

```ts
// core — src/gasless/get-gasless-service-health/
export interface GaslessServiceHealth {
  status: string;              // "ok"
  service: string;             // "operation-api" | "deposit-api"
  protocolInstance: string;
  chainId: number;
}
export type GetGaslessServiceHealthParameters = Compute<ChainIdParameter & { service: GaslessService }>;
export function getGaslessServiceHealth(config: Config, p: GetGaslessServiceHealthParameters): Promise<GaslessServiceHealth>;
// throws: GASLESS_INSTANCE_MISMATCH (body/header instance ≠ configured), GASLESS_CHAIN_MISMATCH (chain_id ≠ chainId)
export function getGaslessServiceHealthQueryKey(...); export function getGaslessServiceHealthQueryOptions(...);

// core — internal, src/gasless/assert-gasless-layer-coherence.ts
async function assertGaslessLayerCoherence(config: Config, chainId: number): Promise<void>;
// multicall: instantLayer(), accountLayer(), core(), collateralToken() vs chain.addresses
// { instantLayerAddress, accountLayerAddress, symmioAddress (diamond), collateralAddress }
// throws GASLESS_CONFIG_INCOHERENT with the mismatched field(s) listed
// cached per (Config, chainId) in a WeakMap; a failed read is NOT cached (retry next call)

// react
export function useGaslessServiceHealth(p): UseQueryResult<GaslessServiceHealth, SymmioRequestError>;
```

### Integration points

- **Replace `assertGatewayCoherence`** in the dispatcher with the shared helper. It must keep caching the in-flight promise without swallowing the rejection; a past review found the old cache pre-swallowed and let concurrent writes skip the guard.
- **Call it at the top of:**
  - `getGaslessDepositPolicy`
  - `getGaslessWalletAddress`
  - `getGaslessWalletCreationFee`
  - `getGaslessFeeQuote`
  - `gaslessWalletExecute`
  - `relayGrantDelegation`
  - `relayInstantOperations`
  - both settle actions
- **Execution config opt-out:** `execution.assertCoherence?: boolean`, default `true`, for tests or exotic setups.
- **apps/web:** a canary badge on `gasless-service-card.tsx`, rendering both services' health, the instance, `chain_id`, and whether the stream is enabled.

### Docs impact

- New `apps/docs/app/core/gasless/get-gasless-service-health/page.mdx` + `_meta.ts` entry.
- A "Coherence" subsection in `core/gasless/page.mdx`: what is compared, the error code, the opt-out.
- A `GASLESS_CONFIG_INCOHERENT` row on every affected action page's Throws section.
- `react/gasless/page.mdx`: the hook.

### Tests

- Health:
  - header and body instance match;
  - `chain_id` mismatch;
  - unknown-instance 404 surfaces as a config error, not "not found";
  - 401 on a key-required gateway.
- Coherence:
  - each mismatched field;
  - cache hit, and no cache on rejection;
  - concurrent callers share one read;
  - the opt-out skips it.
- Each wired action throws before any signature request or POST (assert `signTypedData` and axios not called).

### Risks / open points

- **Cost:** one extra multicall per Config and chain (cached), plus one health GET when the hook is mounted.
- **Quota:** health probably counts against the anonymous 10 RPS; only docs and openapi are exempt (lines 171–173). Poll it slowly (e.g. `staleTime` 60 s) or only on demand.
- **Config pairing:** `core()` needs to map to the right config address. Check which `addresses` field is the diamond (`symmioAddress` or similar in `core/chains/types.ts`).
- **Fail-closed:** a chain config that legitimately uses a different collateral address than the GaslessLayer would now fail closed. That is intended, but document it.

**Dependencies:** S1 (full ABI for `core()`, `accountLayer()`), S3 (`gasless-url.ts`, header assertion).

---

## 2. Sign-without-submit helpers (atomic mixed batches)

### Problem

- The gateway executes a `relayInstantBatch` atomically: "one revert rolls back the batch and its fees" (673–675).
- The doc describes three batch shapes the SDK cannot build today:
  1. **An InstantLayer op plus a GaslessWallet op in one batch:** `signedOps = [ordinaryOp, walletOp]`, `walletIds = [0n, walletId]` (261–272).
  2. **An owner-signed grant plus the first delegate-signed op:** "A delegate-signed operation can follow its owner-signed grant in the same ordered batch" (682–683). This is the one-relay session-key onboarding Vibe-ui-v2 shipped in `5c19e1e4c` ("batch gasless session setup").
  3. **An operational-fee approval inside the batch whose ops it pays for** (690–693). This works because fees are collected **after** the batch executes.
- Nonce rule: within a batch, use consecutive nonces per `(selectedWallet, signerAccount)` stream; separate positive IDs have separate streams, and InstantLayer nonces follow their own rules (357–362).

**Today:**

- Wallet-op signing exists only inside `gaslessWalletExecute`, which always submits a single-op batch (`gasless-wallet-execute.ts:231-305`).
- `relayGrantDelegation` signs and submits a single-op batch (`relay-grant-delegation.ts:99-118`).
- `relayInstantOperations` accepts pre-signed ops (`relay-instant-operations.ts:11-60`), but nothing exported produces a signed op without submitting it.
- The transparent dispatcher assigns consecutive nonces assuming one signerAccount stream (`maybe-relay-as-gasless.ts:340-349`).

### What S1–S12 already provide

- **S6:** `GaslessSignedOperationInput.walletId?: bigint` and explicit decimal-string `walletIds` on every relay; guards for empty batch and template-requires-all-zero; nonce stream keys `instant:${signer}`, `wallet:0:${signer}`, `wallet:${id}:${owner}:${signer}`; the pending-stream guard.
- **S1:** `getGaslessFeeQuote({ operations: { operation, walletId }[] })` quotes a mixed batch correctly. `previewFeeQuote` prices wallet ops by their inner selectors and adds `walletCreationFee18` on first use.
- **S7:** one idempotency key per signed payload.

What is missing is the **exported signing primitives** and a **multi-stream nonce allocator** a caller can compose.

### Signing facts the helpers must encode

- **InstantLayer ops:**
  - EIP-712 domain `SymmioInstantLayer`, 7-field `SignedOperation` including `flexFields` and `maxUses`.
  - `verifyingContract` = InstantLayer.
  - Nonce = `InstantLayer.nonces(signerAccount) + 1`.
- **Wallet ops:**
  - Domain **`GaslessGateway`** version `1`, `verifyingContract` = the GaslessLayer proxy.
  - 5-field type: `signer`, `target`, `callData`, `signerAccount`, `replayAttackHeader`. No `flexFields`/`maxUses` in the signed type; the transport still carries `flexFields: []` and `maxUses: 1`.
  - `walletId` is **not** signed; it is selected through `target = getGaslessWalletAddress(owner, walletId)`.
  - Nonce = `walletOperationNonces(owner, walletId, signerAccount) + 1`.
  - Existing code: `src/gasless/eip712.ts`.
- **Grant ops (677–681):**
  - Encode `InstantLayer.grantDelegation(DelegationInfo)` as `callData` with the InstantLayer as target.
  - Owner-signed; Party A `signerAccount`; empty `flexFields`; `maxUses = 1`.
  - `buildSignedOperation` hard-codes `isPartyB: false`.
- **Deadlines** are Unix seconds. **Salt** is 32 random bytes. See §4.6 for the optional fee-limit salt layout.

### Proposed API

```ts
// core — src/gasless/sign-gasless-instant-operation/
export type SignGaslessInstantOperationParameters = Compute<
  ChainIdParameter & {
    target: Address;
    callData: Hex;
    signerAccount: Address;
    nonce?: bigint; // default: InstantLayer.nonces(signerAccount) + 1
    deadline?: bigint; // default: now + 600 s
    salt?: Hex;
  }
>;
export function signGaslessInstantOperation(config, p): Promise<GaslessSignedOperationInput>; // walletId: 0n

// core — src/gasless/sign-gasless-wallet-operation/
export type SignGaslessWalletOperationParameters = Compute<
  ChainIdParameter & {
    calls: readonly GaslessWalletCall[]; // reuse gasless-wallet-execute/calls.ts encoder
    walletId?: bigint;
    owner?: Address;
    signerAccount?: Address;
    nonce?: bigint;
    deadline?: bigint;
    salt?: Hex;
  }
>;
export function signGaslessWalletOperation(config, p): Promise<GaslessSignedOperationInput>; // walletId set

// core — batch nonce allocation (the hard part)
export interface GaslessNonceStreamLease {
  next(stream: GaslessNonceStream): bigint;
  release(): void;
}
export type GaslessNonceStream =
  | { kind: "instant"; signerAccount: Address }
  | { kind: "wallet"; owner: Address; walletId: bigint; signerAccount: Address };
export function acquireGaslessNonceStreams(
  config,
  p: { chainId?; streams: readonly GaslessNonceStream[] },
): Promise<GaslessNonceStreamLease>;
// takes the S6 stream locks in a canonical sorted order (deadlock-free), reads each current nonce once,
// hands out current+1, current+2, … per stream; release() after relayInstantOperations returns 202
// (the S6 pending-stream guard then records the signed high-water mark per stream)
```

`gaslessWalletExecute` would become `signGaslessWalletOperation` followed by `relayInstantOperations`. `relayGrantDelegation` would become `signGaslessInstantOperation(grant)` followed by `relayInstantOperations`. That removes the duplicated signing and nonce code.

### Composition example (for docs)

```ts
const lease = await acquireGaslessNonceStreams(config, { streams: [
  { kind: "instant", signerAccount: subAccount },
] });
try {
  const grant = await signGaslessInstantOperation(config, { target: instantLayer, callData: encodeGrant(...), signerAccount: subAccount, nonce: lease.next({ kind: "instant", signerAccount: subAccount }) });
  // delegate op signed by the session key — same signerAccount stream (InstantLayer nonces are per signerAccount)
  const first = await signGaslessInstantOperation(sessionKeyConfig, { ..., signerAccount: subAccount, nonce: lease.next({ kind: "instant", signerAccount: subAccount }) });
  await relayInstantOperations(config, { operations: [grant, first], operationType: "grantAndOpen" });
} finally { lease.release(); }
```

### Docs impact

- New pages `sign-gasless-instant-operation`, `sign-gasless-wallet-operation`, `acquire-gasless-nonce-streams`.
- `relay-instant-operations/page.mdx`: a mixed-batch section with per-stream nonces, aligned walletIds, and quoting with `getGaslessFeeQuote`.
- A guide section in `guides/gasless-wallet-calls/page.mdx`: grant + first op, and approve + op.

### Tests

- Signatures verify with viem `verifyTypedData` against the right domain per kind.
- A wallet op's target equals the derived address for its `walletId`.
- The lease hands out consecutive nonces per stream and independent sequences across streams; lock order is canonical (two leases with reversed stream order must not deadlock); `release` is idempotent.
- A mixed batch body has aligned `walletIds`.
- `gaslessWalletExecute` and `relayGrantDelegation` regression tests pass unchanged after the refactor.

### Risks / open points

- **The lease exposes lock lifetime to caller code.** A caller that forgets `release()` blocks the stream. Mitigations: a bounded lease timeout (e.g. the minimum signature deadline), and a `withGaslessNonceStreams(config, streams, fn)` wrapper as the primary API.
- **Two signers in one batch** (owner grant + session-key op) means two wallet clients. The helpers take `config` per signer or an explicit `walletClient` parameter; decide which.
- **Template batches** (`relayInstantTemplate`) stay all-zero wallet IDs; the helpers must not be used with `templateId` for wallet ops.
- **PartyB is unsupported** (`isPartyB: false` hard-coded). Keep throwing `GASLESS_PARTYB_UNSUPPORTED`.
- **The approve-in-batch quote is a special case.** `previewFeeQuote` prices a _single_ approval-only op at the multiplier it sets (`GaslessFeeQuoteLib._operations`, the approval branch). A mixed batch that approves and then acts is priced with the _current_ allowance state, so the quote may show a payer or fee that simulation resolves differently. Document that the service's simulation is authoritative (690–693).

**Dependencies:** S1, S6, S7.

---

## 3. Advisory affordability check

### Problem

The doc asks the frontend to track and verify, separately:

- the payer's Core balance and operational-fee allowance, where the allowance charger is the **GaslessLayer proxy**, not the executor;
- the collateral at `(owner, walletId)`;
- native gas for direct transactions (697–708).

It also says:

- "Read back the allowance before submission" (743).
- For withdrawals: `required Core balance = withdrawal in Core units + operational fee in Core units`, and reserve other pending operations' budgets too (755–771).
- `OperationalFee: Insufficient balance` is fixed by funding the payer, **not** by approving allowance or funding the executor (706–708, 882).

**Today:**

- The dispatcher preflight blocks only on the quota flag (`maybe-relay-as-gasless.ts:352-366`, `GASLESS_FEE_UNAFFORDABLE`). After S1 it blocks only on the `DailyFreeOpsLimitExceeded` revert.
- Nothing compares the fee with the payer's allowance or balance, and nothing budgets a withdrawal amount plus its fee.
- Docs claim otherwise: `apps/docs/app/core/gasless/relayable-writes/page.mdx:47` and `get-gasless-fee-quote/page.mdx:19`. S1 corrects that text.
- apps/web `features/integration/withdraw-flow.tsx:95-101` sends the typed amount with no fee reserve. Relayed finalize and cancel (`:376`, `:387`) charge a fee from a sub-account the withdrawal may already have emptied.
- A user withdrawing the full balance succeeds at "initiate" and then cannot finalize gaslessly.

### Why advisory, not blocking

A blocking check contradicts the doc (688–693):

- Fees are collected after execution, so an approval inside the batch can fund the fee.
- perps-core falls back to the signer's virtual account when the billing parent cannot pay.
- The service therefore treats full `eth_call` simulation as authoritative over a pre-execution allowance snapshot.

So the check must be **opt-in and non-blocking by default**, and must stand down when the batch contains `approveOperationalFee` or the outcome depends on in-batch fund movements.

### Contract facts that make this cheap and exact-ish

`previewFeeQuote` already runs the contract's payer planner, `GaslessOperationalFeeLib._planOperationalFees`:

- **Parent first:** the billing parent pays while `due + fee <= allowance && due + fee <= balanceOf(payer) + allocatedBalanceOfPartyA(payer)` (`_covers`).
  - `allowance` comes from `Core.getOperationalFeeAllowance(payer, gaslessLayer)`, with ready timelocked reductions already applied.
  - The per-payer `feeMultiplier` is applied.
- **VA fallback:** otherwise the signer VA pays, if it exists and covers the fee at its own multiplier.
- **Neither can pay:** the fee stays on the parent, "so core reverts as usual".

So after S1 every `GaslessFeeQuote.payments[i]` already names the payer the contract **would** pick. The advisory check only has to:

1. Group `payments` by `payer` and sum `operationalFee18 + walletCreationFee18` (Core 18-dec).
2. Read, per payer:
   - `Core.getOperationalFeeAllowance(payer, gaslessLayerAddress)`, a 4-tuple `(allowance, pendingAllowance, reductionReadyAt, feeMultiplier)`, via the existing `symmio-contracts/symmio/actions/get-operational-fee-allowance.ts`;
   - `Core.balanceOf(payer) + Core.allocatedBalanceOfPartyA(payer)`.
3. Replicate `_covers`, subtracting any caller-declared extra debit (e.g. a withdrawal amount already in Core units).

If the planner left a fee on a parent that does not cover it, that is precisely the "neither can pay" branch: a certain revert unless in-batch operations change state.

### Proposed API

```ts
// core — src/gasless/get-gasless-affordability/
export interface GaslessPayerAffordability {
  payer: Address;
  fee18: bigint; // Σ operationalFee18 + walletCreationFee18 for this payer
  extraDebit18: bigint; // caller-declared (e.g. withdrawal amount scaled to 18 dec)
  allowance18: bigint; // effective allowance to the GaslessLayer (timelock-applied)
  pendingAllowance18: bigint;
  reductionReadyAt: bigint;
  balanceCapacity18: bigint; // balanceOf + allocatedBalanceOfPartyA
  allowanceShortfall18: bigint; // max(0, fee18 − allowance18)
  balanceShortfall18: bigint; // max(0, fee18 + extraDebit18 − balanceCapacity18)
}
export type GaslessAffordabilityVerdict = "ok" | "allowance-short" | "balance-short" | "both-short" | "indeterminate";
export interface GaslessAffordability {
  verdict: GaslessAffordabilityVerdict;
  /** "indeterminate" reasons — batch approves fees, moves funds, or VA fallback may apply */
  caveats: readonly ("in-batch-approval" | "in-batch-fund-movement" | "va-fallback-possible")[];
  payers: readonly GaslessPayerAffordability[];
  quote: GaslessFeeQuote;
}
export function getGaslessAffordability(
  config,
  p: {
    chainId?;
    operations: readonly GaslessFeeQuoteOperation[];
    extraDebits18?: readonly { payer: Address; amount18: bigint }[];
  },
): Promise<GaslessAffordability>;
// + query key/options; react useGaslessAffordability

// opt-in dispatcher integration
interface GaslessExecutionConfig {
  preflightAffordability?: "off" | "warn" | "block"; /* default "off" */
}
// "warn": fires onEvent({ type: "affordability", chainId, affordability }) and proceeds
// "block": throws GASLESS_FEE_ALLOWANCE_INSUFFICIENT / GASLESS_FEE_BALANCE_INSUFFICIENT (pre-acceptance, honors fallback:"wallet")
//          ONLY when verdict is definitive (no caveats); otherwise proceeds

// withdrawal budgeting helper (pure, uses S5 core-units helpers)
export function getGaslessWithdrawBudget(p: {
  amount: bigint;
  collateralDecimals: number;
  fee18: bigint;
  reserved18?: bigint;
}): { required18: bigint };
```

**Caveat detection:**

- `in-batch-approval`: any op whose target is Core and whose selector is `approveOperationalFee` or `approveOperationalFeeWithMultiplier`, including through AccountLayer `_call`.
- `in-batch-fund-movement`: selectors from `GASLESS_RELAYABLE_WRITES` that move Core balance (deposit, withdraw, allocate, deallocate, transfer).
- `va-fallback-possible`: some op's `signerAccount` is a live VA different from its billing parent.

### apps/web usage

- **Withdraw flow:**
  - Quote the `initiateWithdraw` op.
  - Show "fee X (quote)" and "required balance = amount + fee (Core units)".
  - Warn when `balanceShortfall18 > 0`.
  - Warn that a relayed finalize or cancel also needs a fee budget after the withdrawal.
- **Allowance card:** show `allowanceShortfall18` against a representative quote.
- **Pending budgets** (doc 771) come from the S11b pending-workflow store: sum the `fee18` of non-terminal workflows for the same payer and pass it as `extraDebits18`.

### Docs impact

- New `get-gasless-affordability/page.mdx`.
- A "Budgeting" section in `core/gasless/page.mdx`: which balance pays, the allowance charger, VA fallback, why the check is advisory.
- `react/withdraw/page.mdx`: amount + fee budget.
- `relayable-writes/page.mdx`: `preflightAffordability`.
- `errors-and-fallback/page.mdx`: the two new codes.

### Tests

- Grouping by payer; each verdict; each caveat forces `"indeterminate"`.
- `extraDebits18` affects only the balance shortfall.
- Dispatcher: `"warn"` never throws; `"block"` throws only when definitive and returns `null` under `fallback: "wallet"`.
- The withdraw budget helper at 6 and 18 decimals.
- Compare against a real staging batch with read-only probes: the planner's payer equals `payments[i].payer`.

### Risks / open points

- **TOCTOU:** balances can change between the check and execution. The check is advisory by design.
- **Read path:** `Core.balanceOf` and `Core.allocatedBalanceOfPartyA` are both in the pinned `symmio.ts` ABI and are exactly the reads the planner uses (`_payerSlot`).
- **Fee units:** the unit of the gateway acceptance fields `paid_fee`/`remaining_fee_allowance` is unconfirmed (vendor follow-up). Do not mix them into this check; use only on-chain reads and the preview quote.
- **Cost:** extra RPC reads per preflight (one multicall per payer); cache for a block.

**Dependencies:** S1 (quote payments), S5 (unit helpers), S7 (error classification), S11b (pending store for reserved budgets).

---

## 4. Other deferred items

### 4.1 Native gas top-up

- **Doc:** 777–785 (rules), endpoint `POST {operationBase}/gateway/relay-native-gas-top-up` (144); status on the operations service and stream. Not verified in the stage run (line 39). **Product decision: out of scope.**
- **Contract surface** (latest ABI):
  - `relayNativeGasTopUp(NativeGasTopUpRequest{payerAccount, recipientWallet, collateralAmount, minNativeAmountOut, nonce, deadline}, signature)`
  - `topUpNonces(address)`
  - `getNativeGasTopUpCharge(collateralAmount18) → (feeAmount, totalCollateralCharge)`
  - `nativeGasTopUpFeeBps`, `maxNativeGasTopUpAmount`, `dailySponsoredNativeLimit`, `dailyNativeSponsorUsage(payer) → (day, amount)`, `revertWhenNativeSponsorLimitExhausted`
  - Errors `NativeGasTopUp*`, event `NativeGasTopUpRelayed`.
- **EIP-712** (`GaslessNativeGasTopUpLib.sol`):
  - `NativeGasTopUpRequest(address payerAccount,address recipientWallet,uint256 collateralAmount,uint256 minNativeAmountOut,uint256 nonce,uint256 deadline)`
  - A **capped** variant `CappedNativeGasTopUpRequest(…,uint256 maxTotalCharge)`
  - Verifying contract = the GaslessLayer proxy; domain from `GaslessLayerDomain.sol`.
- **Quote:** `previewFeeQuote(relayNativeGasTopUp calldata, nativeAmount)` returns `nativeTopUpFee18` and `nativeGasCollateral18`, with `nativeSponsored` set when sponsored.
- **Wire (staging OpenAPI):** `NativeGasTopUpRequestModel` has `collateralAmount`/`minNativeAmountOut` as **strings** and `nonce`/`deadline` as integers.
- **Live:** staging `maxNativeGasTopUpAmount() = 0` and `nativeGasTopUpFeeBps() = 0`, so top-up is effectively disabled there. Production reports `1e15` max but is legacy and unsupported.
- **Shape if picked up:**
  - `getNativeGasTopUpPolicy`, `getNativeGasTopUpNonce`, `relayNativeGasTopUp` (signs the request, capped variant optional, posts, returns a receipt);
  - hooks, a web card, docs pages;
  - never infer the charge client-side; never reuse a signature after nonce, deadline, amount, recipient or instance changes (783–785).

### 4.2 Partner-key WebSocket handshake headers

- **Doc 456–460:** browser `new WebSocket(url)` is always anonymous. Higher-rate partners use a server/BFF or a WebSocket library with handshake header support, **never** keys in the query string, subprotocol or subscription JSON.
- **SDK:** the public `WebSocketConstructor` is `new (url: string, protocols?: string | string[]): WebSocketLike` (`packages/trading-core/src/shared/types/websocket.ts:36-38`), so there is no header channel. S10's stream is anonymous even when `apiKey` is set.
- **Option:** an additive third constructor argument `options?: { headers?: Record<string, string> }` (Node `ws` accepts it; browsers ignore it). The gasless hub would pass `Authorization: Bearer <apiKey>` only when `typeof window === "undefined"` or when a new `statusStream.authenticate: true` is set.
- **Public-type change on a released package.** Needs a proposal. Server-side consumers would then share the partner quota for handshakes and commands (doc 594).

### 4.3 GaslessLayer event decoders and historical ABIs

- **Doc 364–392:** three event formats by deployment block — v1 (pre wallet IDs), v2 (wallet IDs, 5-field settlement), and current (6-field `WalletDepositSettled` with `uint8 destination`; renamed args `DepositFeeCollected.owner`, `totalFee18`, `amount18`, `WalletOperationRelayed.owner`). The extra `destination` field changes the topic, so an old decoder "misses" successful settlements.
- **Today:** the SDK decodes no GaslessLayer logs. `confirmGaslessRequest` returns a raw receipt; `toGaslessRequestTransaction` drops the attempt `receipt` (S8 keeps it).
- **After S1:** the full current ABI is exported, so consumers can `parseEventLogs({ abi: gaslessLayerAbi, logs })` for current-generation receipts.
- **Deferred:**
  - Typed helpers such as `parseGaslessDepositSettlement(receipt) → { owner, walletId, subAccount, netDeposit, depositFee, destination: "new-account" | "existing-account" }` and `parseGaslessRelayFees(receipt) → OperationalFeeRouted[]`. These would give the final credited amount the deposit card currently has to estimate.
  - Shipping v1/v2 historical ABIs. This conflicts with `packages/trading-core/ARCHITECTURE.md` §2's one-contracts-version-per-release doctrine unless modeled like `contractsVersion` (§2.5) with pinned legacy fragments and a declared per-deployment activation block. The doc says the observation block in its ABI notes is **not** an established upgrade block (370); operators must provide it.

### 4.4 `withdrawWalletFunds` wrapper

- **Latest ABI and source** (`GaslessLayer.sol:312-334`): `withdrawWalletFunds(uint256 walletId, address token, address recipient, uint256 amount) returns (uint256)`.
  - It is `msg.sender`-scoped (the owner calls it directly and pays native gas).
  - `amount = type(uint256).max` withdraws the full balance.
  - It collects the wallet creation fee if the wallet is undeployed.
  - Emits `WalletFundsWithdrawn(owner, walletId, token, recipient, amount)`.
- **Not in the vendor doc.**
- **Why deferred:** it defeats the gasless purpose. The same outcome is already gasless via `gaslessWalletExecute({ walletId, calls: [erc20.transfer(recipient, amount)] })`.
- **Worth adding** as a "rescue" path when the relayer is down or the payer cannot cover the operational fee. Wrap it as a normal wallet write (`withdrawGaslessWalletFunds`) plus a hook, and document it as the non-gasless escape hatch.
- **Doc 250s:** `recoverNonCollateralToken(owner, walletId, token, recipient)` is a **config-admin** action; the SDK should not wrap it.

### 4.5 `simulateFeeQuote` / `executeWithFeeLimit`

- **`simulateFeeQuote(bytes callData)`** always reverts:
  - `FeeQuoteResult(FeeQuote)` with `exact = true` on success;
  - `FeeQuoteExecutionFailed(bytes)` on failure.
  - It runs the real action "including signatures, roles and fee collection", so `from` must be the submitting relayer, admin or owner (`GaslessLayer.sol:345-351`).
  - A frontend cannot impersonate the relayer role for relay batches, so an exact quote is only available to the service. `previewFeeQuote` (S1) is the frontend path and always returns `exact = false`.
- **`executeWithFeeLimit(bytes callData, uint256 maxTotalDebit18)`** is useful for unsigned settlement or admin actions run by the relayer; it retains the underlying action's roles.
- **Possible SDK use:** simulate owner-callable actions (e.g. `withdrawWalletFunds` from 4.4) with `from = owner` to get an exact quote before prompting. Revisit together with 4.4.

### 4.6 Salt-encoded signed fee limits

- **Not in the vendor doc**, but live in perps-core (`libraries/GaslessFeeLimits.sol`). A signed operation's 32-byte `salt` can commit to a maximum fee:
  - Layout: 8-byte tag `bytes8(keccak256("SYMMIO_GASLESS_FEE_LIMIT_V1"))`, then 16-byte max fee (uint128, 18 decimals), then 8 random bytes.
  - `check(salt, actual)` reverts with `FeeLimitExceeded(actual, maximum)` when the tag matches and `actual > maximum`.
  - Legacy random salts are uncapped.
  - "A limit applies to each use of its operation, including wallet deployment fees and VA fallback."
- **Value:** protects the user against a fee increase between quote and execution, with zero extra RPC. It is the user-signed analogue of `executeWithFeeLimit`.
- **Shape:**
  - `maxFee18?: bigint` on relayable writes, `gaslessWalletExecute` and the §2 sign helpers.
  - Build the salt with an exported `encodeGaslessFeeLimitSalt(maxFee18, random8?)`.
  - Default could be `quote.payments[i].operationalFee18 + walletCreationFee18` times a small multiplier, making every preflighted write capped automatically.
  - Map `FeeLimitExceeded` in `classifyGaslessFailure` as `"fee-limit"` (the reason already exists in S7).
- **Verify first:**
  - Changing the salt changes the signed digest, so existing signature tests move.
  - The vendor service must not reject tagged salts (no doc mention; test on staging with the user's funded wallet).
  - Whether InstantLayer-domain ops honor the same salt check (the library is referenced from GaslessLayer paths; confirm in `GaslessWalletExecutionLib`/`GaslessLayer._collectOperationalFees`).

### 4.7 Cross-tab / cross-device nonce coordination

- **Doc 359–362:** "Coordinate pending requests from other tabs/devices before signing. The service forwards signed nonces and does not reserve, replace, or repair them."
- **SDK:** the S6 lock and pending-stream guard are in-memory per `Config`, so they coordinate within one JS realm only.
- **Reference:** Vibe-ui-v2 serializes per payer with `navigator.locks` keyed `network:user:account`, and persists the exact signed request (AES-GCM, localStorage) for byte-identical resubmission (`lib/trading/vibecaps/gaslessqRecovery.ts:16-19, 71-150`).
- **Options:**
  - **(a) App-level (recommended first step):** apps/web wraps gasless writes in `navigator.locks.request("gasless:" + streamKey, …)` and shares the S11b pending-workflow store via a `storage` event or `BroadcastChannel`.
  - **(b) SDK seam:** an injectable `createConfig({ gaslessCoordinator: { lock(key, fn), getPending(key), setPending(key, entry) } })`. The default is in-memory; a browser implementation uses `navigator.locks` plus localStorage. That is a public config addition and needs a proposal.
- **Cross-device** is only solvable server-side (a by-owner pending lookup), which the gateway does not offer. At minimum, re-read nonces immediately before signing (already done) and rely on the S6 guard.

### 4.8 Public `tx_hash` stream watcher and attempt-by-hash read

- **Doc 147, 159, 504, 516:**
  - `GET {base}/transactions/{tx_hash}` on both services;
  - WS `{"type":"subscribe","tx_hash":"0x…"}` streams one `TransactionAttemptRecord` (with `entity_id`); hash selectors are lowercased.
- **Live:** the route answers 404 `{"detail":{"code":"NOT_FOUND","message":"transaction attempt not found"}}` for unknown hashes on staging.
- **S10's hub parser** already handles `tx_hash` selectors internally.
- **Deferred public API:**
  - `getGaslessTransactionAttempt(config, { chainId?, service, txHash })` + query options + hook, reusing `to-gasless-request-transaction.ts`;
  - `watchGaslessTransactionAttempt(config, { service, txHash, onUpdate, … })`.
- **Use case:** an explorer or inspector view that starts from a hash, not a request id.

### 4.9 `approveOperationalFee` overwrites the fee multiplier

- `packages/trading-core/src/symmio-contracts/symmio/actions/approve-operational-fee.ts` always encodes `approveOperationalFeeWithMultiplier` with a default multiplier of `10000n`. That resets any multiplier the payer had configured.
- `GASLESS_RELAYABLE_WRITES` registers only the `WithMultiplier` selector (`packages/trading-core/src/gasless/relayable-writes.ts:69-72`).
- **Doc 732–741** uses the plain `approveOperationalFee([gaslessLayer], [targetAllowance18])`.
- `previewFeeQuote` prices a single approval-only op at the multiplier it **sets** (`GaslessFeeQuoteLib._operations`, approval branch). The implicit reset to 10000 therefore also changes the quoted fee.
- **Fix:**
  - Encode plain `approveOperationalFee` when `feeMultipliers` is omitted; use `WithMultiplier` only when multipliers are explicitly passed.
  - Register the plain selector as relayable.
  - Update the docs page and the S11c allowance card.
- **No semver cost:** `approveOperationalFee` is not on `origin/main` yet (checked 2026-09-17), so the default can change freely before release.

---

## 5. Suggested order

1. **§4.9** (small correctness fix) and **§1** (health + coherence). Low risk; protects funds.
2. **§3** (advisory affordability) together with **§4.6** (fee-limit salts). Both build on the S1 quote, and together they give "warn early, cap at execution".
3. **§2** (sign-without-submit + nonce streams lease). Unlocks one-relay session onboarding and approve-in-batch.
4. **§4.7(a)** (app-level cross-tab locks) after §2, since leases define the stream keys to lock.
5. **§4.3** typed decoders for current events (final deposit credit), then **§4.8** (hash-based reads).
6. **§4.4** / **§4.5** rescue path.
7. **§4.2** partner-key WS headers and **§4.1** native top-up, only on product demand. Top-up is disabled on staging today.
