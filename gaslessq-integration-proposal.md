# Design Proposal: GaslessQ relayer integration (`gasless` slice)

**Status**: **APPROVED & IMPLEMENTED** (2026-09-04). The slice shipped across `packages/trading-core/src/gasless/` (+ seam edits + full v0.8.6 InstantLayer ABI + diamond allowance actions), `packages/trading-react/src/gasless/` (new `./gasless` subpath, 12 hooks), `apps/docs/app/{core,react}/gasless/` (17 pages + concepts section + callouts on 7 existing pages), and `apps/web` (`/gasless` page, request storage, reference key-hiding proxy at `/api/gasless`). Native gas top-up stayed out by product decision. Deviations from this document are noted inline where they occurred; §8.1's open items (registry InstantLayer update after vendor staging convergence, HyperEVM enablement, in-batch approve probe) remain.
**Revision 2** — rewritten against the perps-core GaslessLayer service (instance-routed URLs, RPC-only reads, delegation-as-operation) and against a **working reference implementation** in `/home/seyyed/dev/symmio/Vibe-ui-v2` (HEAD `151c57a0d` — "feat(vibecaps): migrate GaslessQ to perps-core"). Where the vendor doc and that code disagree, **the code wins** and the conflict is listed as an open question.

**Goal**: Ship a `gasless` slice in `@symmio/trading-core` + `@symmio/trading-react` that integrates the GaslessQ relayer — explicit primitives for every in-scope flow (instant-operation relay, delegation grant, gasless-wallet execute, deposit settlement; native gas top-up is deferred by product decision) plus a transparent execution mode that lets existing write actions relay through the service with zero signature or behavior change for consumers.

**Reference**:

- Vendor "Chapter 2 — Frontend and API" (supplied 2026-09-04) + the team's breaking-change note.
- `/home/seyyed/dev/symmio/Vibe-ui-v2` — production GaslessQ integration. Chiefly `lib/trading/vibecaps/{gaslessqOperation,gaslessqWallet,gaslessqDeposit,gaslessqWithdraw,gaslessqMargin,gaslessqCreateSubAccount,gaslessqFallback,operationalFee,instantLayer,instantLayerNonce,staticConfig}.ts`, `app/api/gaslessq/_lib/proxy.ts`, `hooks/{useVibecapsWithdrawBridge,useVibecapsDelegation,useVibecapsDeposit}.ts`.
- In-repo: `packages/trading-core/src/solvers/instant-open/shared/{eip712,operations}.ts` (SignedOperation stack, reused verbatim), `packages/trading-core/src/pools/` (optional chain-level authed HTTP service template), `packages/trading-react/src/tpsl/` (sign-then-POST + confirmation-timeout precedents).

---

## 0. What changed since revision 1

| Area                             | Revision 1 assumed                                                | Now verified                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL model                        | `{origin}/v1/{operations\|deposits}`                              | `{origin}/v1/instances/{protocolInstance}/{operations\|deposits}`; **instance is not derivable from chainId** (staging and production are both 42161)                  |
| Delegation                       | separate `/gateway/relay-delegation`, deferred to a later phase   | endpoint **deleted**; delegation is an ordinary owner-signed `InstantLayer.grantDelegation(DelegationInfo)` operation through `relay-instant`. Ships in the main slice |
| Service reads                    | HTTP endpoints for deposit config, wallet address, fee, allowance | **all deleted** — every read is an RPC contract read. The SDK owns them                                                                                                |
| Gateway address                  | resolved at runtime from `charger_address`, TTL-cached            | a **config constant** (no discovery mechanism exists any more)                                                                                                         |
| Gateway ABI                      | entirely missing, blocking flows 2/3                              | the **5-function read surface + `getAccountOperationalFee` are recovered verbatim** from production code; only native-top-up reads remain unknown                      |
| `signerAccount` for margin       | the virtual account                                               | the **parent sub-account** — the VA is only an argument of `addMargin`/`removeMargin`                                                                                  |
| Replay nonce                     | default `0n` (salt-based)                                         | `InstantLayer.nonces(signerAccount) + 1`, read fresh immediately before signing; batches must be strictly sequential                                                   |
| Wire encoding of uint256         | decimal strings                                                   | JSON **numbers** (`nonce`, `deadline`, `maxUses`, flex offsets); server schema is `z.number().int()`                                                                   |
| Wallet-op EIP-712                | assumed InstantLayer-shaped                                       | a **different 5-field struct** (no `flexFields`, no `maxUses`) under domain name `GaslessGateway`, `verifyingContract` = **gateway**, while `target` = wallet          |
| Existing-account settlement body | unknown                                                           | `{ idempotencyKey, wallet, subAccount }`                                                                                                                               |
| API key in the browser           | "config field + proxy caveat"                                     | **the key cannot be in a browser bundle at all**; the reference ships a server proxy. This reshapes the config surface                                                 |

---

## 1. Verified facts

**Contract topology — three contracts, not one.** This is the single most consequential correction.

| Surface                                                                                                                                                 | Contract                                                                                                           | Evidence                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `getGaslessWalletAddress`, `collateralToken`, `depositFee`, `minimumDeposit`, `walletOperationNonces`, `getAccountOperationalFee`, native-top-up policy | **GaslessLayer** (a.k.a. GaslessGateway) — a **separate deployed proxy**, not a diamond facet, not in perps-core   | `Vibe-ui-v2/lib/trading/vibecaps/gaslessqWallet.ts:32-38`, `abi/operationalFee.ts:69-119` |
| `approveOperationalFee[WithMultiplier]`, `chargeOperationalFee`, `getOperationalFeeAllowance`, `getOperationalFeeReceiver`, `isOperationalFeeCharger`   | **Symmio core diamond** — already in our shipped `abi/v0.8.6/symmio.ts` (L9966, 10000, 11012, 19166, 19189, 19207) | grep-verified in this repo                                                                |
| `execute(Call[])`                                                                                                                                       | **GaslessQWallet** — per-owner CREATE2 wallet at `getGaslessWalletAddress(owner)`                                  | `gaslessqWallet.ts:57-59`                                                                 |

`grep -ri gasless` over `packages/trading-core/src/symmio-contracts/abi/` returns **zero** — GaslessLayer is not a facet. `/home/seyyed/dev/symmio/perps-core` has **no GaslessLayer.sol on any branch**; the ABI can only come from the vendor or from the production surface recovered below.

**GaslessLayer read surface (production-proven; the last two discovered by direct probe 2026-09-04):**

```solidity
function collateralToken() view returns (address)
function depositFee() view returns (uint256)
function getGaslessWalletAddress(address owner) view returns (address)   // renamed from getGaslessQWalletAddress
function minimumDeposit() view returns (uint256)
function walletOperationNonces(address account) view returns (uint256)
function instantLayer() view returns (address)     // the InstantLayer this gateway verifies operations against
function accountLayer() view returns (address)
```

**Live on-chain values (Arbitrum, probed 2026-09-04, USDC 6-dec):** staging gateway `0x16d448C8…` — depositFee 0.001, minimumDeposit 0.01, `instantLayer() = 0x473468D6B25D1639Ba96A933556dB937283D803b`; production gateway `0x8347953D…` — depositFee 1.0, minimumDeposit 2.0, `instantLayer() = 0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132`. Both return real deterministic wallet addresses for arbitrary owners.

**Live production OpenAPI (public, `{base}/openapi.json`, fetched 2026-09-04):** `operationType` is a free-form string 1–128 chars (not an enum); `signedOps` has `minItems: 1` and **no max**; `nonce`/`deadline`/`maxUses` are JSON integers (`maxUses` default 1, `flexFields` optional); the operations 202 is `{request_id, status, paid_fee, remaining_fee_allowance}` (all required); the deposit 202 is `{request_id, status, deposit_address, observed_amount, paid_fee, credited_amount}`; `accountData` = `{name (required, 1–64), metadata ("0x"), symmioCore (overwritten), isolationType (enum 0–3, server default 3), singleVAMode (server default false)}`; existing-account settlement = `{idempotencyKey?, wallet, subAccount}`, `additionalProperties: false`.

Plus the fee quote (full tuple ABI at `Vibe-ui-v2/lib/trading/vibecaps/abi/operationalFee.ts:69-119`):

```solidity
function getAccountOperationalFee(address account, SignedOperation[] signedOps) view
  returns (uint256 amountDue, uint256 freeOpsApplied, bool wouldBlockOnQuota)
```

**Diamond allowance read returns a 4-tuple in 0.8.6** — `(allowance, pendingAllowance, reductionReadyAt, feeMultiplier)`. It used to return 6; Vibe-ui-v2 commit `79d802e63` exists solely to fix reading index 2 instead of index 0. Decoding with a stale 6-output ABI does not throw — it silently returns garbage. Our shipped ABI already has the correct 4-output form.

**In-repo state.** `grantDelegation(DelegationInfo)` is present in our `abi/v0.8.6/instant-layer.ts` and `grant-delegation.ts` already encodes exactly `{ account, delegatedSigner, selectors, expiryTimestamp }` — the delegation operation needs no new ABI. **But** our `instant-layer.ts` is a documented _fragment_ with **3 functions**, while perps-core's canonical `abis/instantLayer.json` has **53** — and the one GaslessQ needs, **`nonces(address)`, is missing**. `AccountLayer.getVirtualAccount(account)` returns `{ accountAddress, parentAccount, symbolId, isExists, … }`, so a virtual account's parent sub-account **is** resolvable on-chain (this unblocks transparent margin relay).

**Registry drift — needs team confirmation.** Our Arbitrum block's `symmioAddress` and `accountLayerAddress` match Vibe-ui-v2's **staging** deployment exactly, but our `instantLayerAddress` (`0xDBc6DAe3De0b10a10b6c4d1b33D4C79567E07F6d`) is the value Vibe **replaced** in the perps-core migration (`→ 0x473468D6B25D1639Ba96A933556dB937283D803b`). Our registry therefore appears to point at a pre-migration InstantLayer. `arbitrum-chain.test.ts:22` asserts the same stale value.

Deployment addresses observed in the reference (Arbitrum 42161):

|              | staging (`arbitrum-42161-vibe-stage`)        | production (`arbitrum-42161-vibe`)           |
| ------------ | -------------------------------------------- | -------------------------------------------- |
| diamond      | `0x573310dB6d160B26026B8706EBe9831c7dEF1D09` | `0x57331027091994FCb9c5Aec48ea92cEf0a93CF6A` |
| InstantLayer | `0x473468D6B25D1639Ba96A933556dB937283D803b` | `0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132` |
| AccountLayer | `0x5733107211B2801Acd39933a54d482FE303c4907` | `0x573310d1D6ec18cB21E1aB949414470D9bf5c24E` |
| GaslessLayer | `0x16d448C8180420D4e42529F50556eb2b05311bfF` | `0x8347953D80037b8d82827246f37EC7442AD188B4` |
| origin       | `https://gaslessq-staging.symmio.foundation` | `https://gaslessq.symmio.foundation`         |

**No HyperEVM reference exists.** The vendor lists `hyperevm-999-canonical` / `hyperevm-999-sandbox`, but Vibe-ui-v2 configures only the two Arbitrum instances; `hyperevm-999-sandbox` appears solely in a comment and test fixture. HyperEVM gasless is unvalidated.

---

## 2. Architecture

### 2.1 Connection model and the API-key problem

Bases are `{origin}/v1/instances/{protocolInstance}/{operations|deposits}`. Two independent values, from one place, or staging and production silently cross-wire. The only runtime guard is the **`X-GasLessQ-Protocol-Instance` response header**, which must equal the instance encoded in the base URL — it is never _sent_, only _asserted_, and the reference made a missing header fail-closed (502). The SDK ports this assertion.

The Bearer client key **cannot ship in a browser bundle** (`NEXT_PUBLIC_GASLESSQ_API_KEY` is explicitly banned in the reference). But `trading-core` is framework-agnostic and consumed by servers, CLIs and browsers alike. Resolution: the config carries a **base URL that may be either the vendor origin or the consumer's own proxy origin**, and an **optional** `apiKey`.

```
server / CLI consumer:  url = https://gaslessq.symmio.foundation, protocolInstance = arbitrum-42161-vibe, apiKey = <secret>
browser consumer:       url = /api/gasless (own proxy), apiKey omitted — the proxy injects Authorization and pins the instance
```

The SDK detects an already-instance-scoped base (regex `/v1/(instances/[^/]+/)?(operations|deposits)$`, ported from the reference) and does not re-derive the instance path — so a proxy base works unchanged. `apps/web` ships the reference Next.js route handler; the browser recipe is documented, not hand-waved.

### 2.2 Signer / signerAccount matrix (verified — three distinct patterns)

The signing key and the `signerAccount` are **independent axes**, and the virtual account is **never** a `signerAccount`.

| Operation                                                                                                        | signs                | `signerAccount.addr`                                        | `target`                         |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------- | -------------------------------- |
| `addMargin` / `removeMargin`                                                                                     | session key or owner | **parent sub-account** (VA is a calldata arg)               | AccountLayer                     |
| withdraw legs (`deallocate`, `initiateWithdraw`, `finalizeWithdrawRequest`, `requestCancelWithdraw`, `allocate`) | session key or owner | sub-account                                                 | Symmio diamond                   |
| `createSubAccounts`, `editAccountName`                                                                           | session key / owner  | an existing owned sub-account                               | AccountLayer                     |
| `grantDelegation`                                                                                                | **owner EOA only**   | sub-account                                                 | InstantLayer                     |
| `approveOperationalFeeWithMultiplier`                                                                            | **owner EOA only**   | **sub-account** (so the diamond sees `msg.sender == payer`) | Symmio diamond                   |
| `gaslessqWalletExecute`                                                                                          | **owner EOA only**   | **owner EOA**                                               | the deterministic gasless wallet |

### 2.3 Two EIP-712 domains, two structs, three nonce counters

Conflating these produces signatures that look right and never verify.

|                          | InstantLayer operations                  | Gasless-wallet execute                                                                                |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| domain `name`            | `SymmioInstantLayer`                     | **`GaslessGateway`** (kept deliberately; the contract's rename to GaslessLayer did **not** change it) |
| `verifyingContract`      | InstantLayer address                     | **GaslessLayer address** (while `target` is the wallet)                                               |
| `SignedOperation` fields | 7 (incl. `flexFields`, `maxUses`)        | **5** — no `flexFields`, no `maxUses`                                                                 |
| transport JSON           | as signed                                | still carries `flexFields: []`, `maxUses: 1`, appended **after** signing                              |
| nonce                    | `InstantLayer.nonces(signerAccount) + 1` | `GaslessLayer.walletOperationNonces(owner) + 1`                                                       |
| deadline                 | now + 20 min                             | now + 10 min                                                                                          |

The third counter is `GaslessLayer.topUpNonces(payerAccount)` for native top-ups — whose `+1` convention is undocumented (open question).

**Nonce discipline is a hard requirement, not a nicety.** Nonces are sequential and must be read immediately before signing; a batch must carry strictly consecutive nonces in signed order. Our existing `buildSignedOperation` defaults `nonce: 0n`, which is correct for solver instant-trades but **wrong for GaslessQ** — the gasless path always passes an explicit nonce. Two concurrent relays on one sub-account collide, so the SDK serializes per `(chainId, signerAccount)`; the reference has no such lock and simply re-reads.

### 2.4 Fee model

Fee = `base(selector) × coreMultiplier / 10000`, with a per-account daily free quota. Two reads on two contracts:

- **quote** — `GaslessLayer.getAccountOperationalFee(account, signedOps[])` → `(amountDue, freeOpsApplied, wouldBlockOnQuota)`. Quote the _exact_ operations about to be relayed.
- **allowance** — `Diamond.getOperationalFeeAllowance(payer, charger)` → `(allowance, pendingAllowance, reductionReadyAt, feeMultiplier)`. `charger` is the GaslessLayer address. Allowance _reduction_ is delayed on-chain, hence `reductionReadyAt`.

Granting the allowance is itself a relayed operation (`approveOperationalFeeWithMultiplier([charger], [maxUint256], [10000])`, owner-signed, `signerAccount = sub-account`, target = diamond) and has **no wallet-paid fallback** — `InstantLayer.executeBatch` is relayer-only, so if GaslessQ is down the approval cannot be made at all. **Grant before you need it.**

The vendor says fees are collected _after_ the batch executes, which would permit prepending an approve op into the same batch and a signer-VA fallback when the billing parent cannot pay. **Neither is implemented anywhere** — the SDK would be the first. Both are out of scope for v1 and listed as open questions.

### 2.5 Fallback policy — one primitive, not four copies

Wallet-paid fallback is permitted **only** when the relay definitively rejected _before broadcast_:

```
canFallBack = isConfirmedGaslessFeeLimitError(err)              // code ∈ {FEE_POLICY_WOULD_REVERT, INSUFFICIENT_ALLOWANCE} AND (HTTP 409 OR workflow.status === "rejected")
           || (!relayAccepted && isConfirmedGaslessUnavailableError(err))   // 404/503, or 502 with an upstream 404/500/502/503
```

Never on a timeout, an ambiguous transport failure, or anything after a 202 — the relay may still execute and duplicate the transaction. The reference repeats this composition at four call sites with a local `relayAccepted` latch each time; that latch is the most safety-critical line in the integration, and the SDK owns it once, inside the dispatcher. Deposit settlement has no fallback at all.

### 2.6 The transparent-dispatch seam

Unchanged in shape from revision 1 — two interception points, one internal helper, no existing signature or wallet-path body touched.

- **Seam A** — `symmio-contracts/symmio/internal/call-as-sub-account.ts` (verified: one edit covers **9** `_call`-proxied writes). The `account` parameter is already the sub-account, so `signerAccount` is available for free.
- **Seam B** — `account-layer/actions/{add-margin,remove-margin}.ts`. These receive only the **virtual account**, so the dispatcher resolves the parent via `AccountLayer.getVirtualAccount(virtualAccount).parentAccount` (cached per `(chainId, va)`), or accepts an explicit `gasless: { account }` override.
- Dispatchers `withdraw.ts` / `withdraw-auto.ts` forward the flag; the relayable actions' parameter types gain `& GaslessWriteParameter`, making relayability a compile-time truth.

`maybeRelayAsGasless(config, { chainId, from, gasless, operations, operationType })`:

1. Resolve mode: per-call `gasless` ?? `chainConfig.gasless?.execution?.mode` ?? `"wallet"` → wallet returns `null` (zero overhead default).
2. Availability: unconfigured chain + implicit mode → `null`; + explicit `gasless: true` → `GASLESS_NOT_CONFIGURED`.
3. Selector gate against the relayable map → implicit falls through to the wallet path (**this is the no-behavior-change promise**), explicit throws `GASLESS_NOT_RELAYABLE` or falls back per policy.
4. Acquire the per-`(chainId, signerAccount)` lock; read `InstantLayer.nonces(signerAccount)`; build ops with `nonce = current + 1` (`+ i` across a batch), 20-minute deadline, random salt; sign each with the existing `signSignedOperation` + `getInstantLayerEip712Domain`. **Coherence guard**: before the first relay per config+chain, assert `chainConfig.addresses.instantLayerAddress === GaslessLayer.instantLayer()` (cached) — a mismatch (exactly today's registry-drift situation) throws `GASLESS_CONFIG_INCOHERENT` instead of producing signatures the gateway will reject, or worse, splitting the nonce stream between two InstantLayers.
5. Optional pre-flight (`preflightFee`, default on): `getAccountOperationalFee` → if `wouldBlockOnQuota`, or `amountDue >` available balance, throw a typed `GaslessFeeUnaffordableError` **before** prompting for a signature.
6. POST `relay-instant` with a generated `idempotencyKey`; retry once on a network error/5xx with the **same** key. Definitive 4xx → apply fallback policy.
7. **Point of no return = 202.** Never fall back afterwards; ambiguous retry exhaustion throws `GASLESS_SUBMIT_UNCONFIRMED` carrying the key.
8. Poll (1 500 ms queued / 3 000 ms submitted, tolerating up to 3 consecutive 404s for the accept-vs-record race, bounded by `broadcastTimeoutMs` **and** an `AbortSignal`) until `tx_hash` appears, then **return it as a `Hash`** — so `resolveWriteResult` waits the receipt and `onSuccess` invalidation still runs after on-chain reality (decision.md satisfied by construction). Terminal-without-broadcast → typed errors.
9. Emit `execution.onEvent` at accepted / broadcast / terminal — the provenance and persistence seam.
10. `simulateBeforeWrite` is skipped on the relay branch (the relayer simulates; `SIMULATION_REVERTED` surfaces instead).

### 2.7 Module layout

**Core — `packages/trading-core/src/gasless/`** (one folder per action):

`types.ts` · `wire-types.ts` · `http.ts` (instance-base derivation + `/v1` de-duplication + optional bearer + `X-GasLessQ-Protocol-Instance` assertion + `detail.code` mapping + `generateIdempotencyKey`) · `errors.ts` · `fallback.ts` (the two predicates) · `eip712.ts` (gateway domain + the 5-field wallet type table) · `format-gasless-operation.ts` (bigint → **number**, safe-integer guarded) · `relayable-writes.ts` · `resolve-gasless.ts` · `nonce-lock.ts` · `dispatch/` (internal) · `gateway/gasless-layer-abi.ts`

Action folders: `relay-instant-operations/` · `get-gasless-request/` · `get-gasless-request-transactions/` · `wait-for-gasless-request/` · `relay-grant-delegation/` · `gasless-wallet-execute/` · `get-gasless-wallet-address/` · `get-gasless-wallet-nonce/` · `get-gasless-deposit-policy/` · `settle-gasless-deposit-new-account/` · `settle-gasless-deposit-existing-account/` · `get-gasless-operational-fee-quote/` · `relay-approve-operational-fee/`. (Native-top-up folders are reserved names only — nothing ships this phase.)

New sibling reads (house layout, `symmio-contracts/`): `instant-layer/actions/get-instant-layer-nonce.ts`, `symmio/actions/get-operational-fee-allowance.ts`, `symmio/actions/approve-operational-fee.ts` (+ simulate), `account-layer/actions/get-virtual-account.ts` if absent.

Config edits: `core/chains/types.ts` (+`SymmioGaslessConfig`, +`gasless?`), `core/config/merge-chain-config.ts` (+`mergeGasless` arm — mandatory, unknown keys are silently dropped), `shared/types/properties.ts` (+`GaslessWriteParameter`), the 14 action files of §2.6, root `src/index.ts`. **Also: replace the 3-function `abi/v0.8.6/instant-layer.ts` fragment with the full 53-function ABI** from perps-core `version_0.8.6` — required for `nonces`, and independently required by the repo's own "ABIs must be complete" rule.

**React — `packages/trading-react/src/gasless/`** (new `./gasless` subpath → the four synchronized edits + root barrel): `use-supports-gasless-service`, `use-gasless-request` (terminal-stop polling + `invalidateOnSuccess`), `use-relay-instant-operations`, `use-relay-grant-delegation`, `use-gasless-wallet-execute`, `use-gasless-deposit-policy`, `use-settle-gasless-deposit-{new,existing}-account`, `use-gasless-fee-quote`, `use-operational-fee-allowance`, `use-approve-operational-fee`. Transparent mode needs **zero** react changes.

**apps/web**: `features/gasless/` demo cards + a deposit wizard + the **reference proxy route handler** (`app/api/gasless/[...path]/route.ts`) + `gasless-request-storage.ts`.

**Persistence**: app-side, keyed `(environment, protocolInstance, requestId)` per the vendor's explicit instruction — the reference persists only a coarse network label and admits the instance is missing. The SDK persists nothing; `onEvent` is the hook.

**Naming**: module `gasless`; identifiers `Gasless*`; the contract is `GaslessLayer` in prose and `gaslessLayerAddress` in config; the EIP-712 domain string stays the literal `"GaslessGateway"` behind a commented constant so nobody "fixes" it; the wire `operationType` values stay vendor-exact.

---

## 3. Public API sketch

```ts
// ───────── core/chains/types.ts ─────────
/** Chain-level config for the GaslessQ relayer service. */
export interface SymmioGaslessConfig {
  /** Service base: the vendor origin (server-side consumers) or your own proxy base (browsers). */
  url: string;
  /** Protocol-instance key selecting the deployment, e.g. "arbitrum-42161-vibe". Omit only when `url` is an already-instance-scoped proxy base. */
  protocolInstance?: string;
  /** GaslessLayer proxy address — the operational-fee charger. Update on gateway redeploy; there is no runtime discovery. */
  gaslessLayerAddress: Address;
  /** Bearer client key. NEVER set this in a browser bundle — proxy instead and let the proxy inject it. */
  apiKey?: string;
  /** Transparent execution-mode defaults for existing contract writes. */
  execution?: GaslessExecutionConfig;
}
export interface GaslessExecutionConfig {
  /** "wallet" (default) or "gasless". */
  mode?: "wallet" | "gasless";
  /** Pre-acceptance failure policy. Default "error". */
  fallback?: GaslessFallback;
  /** Quote the fee on-chain before prompting for a signature. Default true. */
  preflightFee?: boolean;
  /** Max wait for broadcast before GASLESS_BROADCAST_TIMEOUT. Default 120_000 ms. */
  broadcastTimeoutMs?: number;
  /** Poll cadence while queued / after submitted. Defaults 1_500 / 3_000 ms. */
  queuedPollMs?: number;
  submittedPollMs?: number;
  /** Lifecycle observer — persist request ids here. */
  onEvent?: (event: GaslessRelayEvent) => void;
}
export type GaslessFallback = "error" | "wallet";

// ───────── shared/types/properties.ts ─────────
/** Opt a single write in/out of gasless relay. */
export interface GaslessWriteParameter { gasless?: boolean | GaslessWriteOptions }
export interface GaslessWriteOptions {
  enabled?: boolean;
  fallback?: GaslessFallback;
  idempotencyKey?: string;
  /** Sub-account to bill and authorize under. Required only when the SDK cannot derive it (see getVirtualAccount). */
  account?: Address;
  broadcastTimeoutMs?: number;
  signal?: AbortSignal;
}

// ───────── gasless/types.ts ─────────
export enum GaslessRequestStatus { QUEUED="queued", SUBMITTED="submitted", SUCCEEDED="succeeded", REVERTED="reverted", FAILED="failed", REJECTED="rejected" }
export const GASLESS_TERMINAL_STATUSES: ReadonlySet<GaslessRequestStatus>;
export function isGaslessRequestTerminal(status: GaslessRequestStatus): boolean;
export type GaslessService = "operations" | "deposits";
export interface GaslessRequest {
  requestId: string; status: GaslessRequestStatus; txHash: Hash | null;
  errorCode?: string | null; errorMessage?: string | null;
  paidFee?: bigint | null; remainingFeeAllowance?: bigint | null;
}
export interface GaslessSubmitReceipt { requestId: string; status: GaslessRequestStatus; paidFee: bigint | null; remainingFeeAllowance: bigint | null }
export type GaslessRelayEvent =
  | { type:"accepted"; requestId:string; service:GaslessService; chainId:number; protocolInstance:string; operationType:string; idempotencyKey:string }
  | { type:"broadcast"; requestId:string; txHash:Hash; chainId:number }
  | { type:"terminal"; requestId:string; status:GaslessRequestStatus; txHash:Hash|null; chainId:number };

// ───────── availability / relayability ─────────
export function resolveGaslessService(config: Config, parameters?: { chainId?: number }): SymmioGaslessConfig;  // throws GASLESS_NOT_CONFIGURED
export function supportsGaslessService(config: Config, parameters?: { chainId?: number }): boolean;
export const GASLESS_RELAYABLE_SELECTORS: readonly Hex[];
export function isGaslessRelayableSelector(selector: Hex): boolean;

// ───────── relay + status ─────────
export interface GaslessSignedOperationInput { operation: SignedOperation; signature: Hex }
export type RelayInstantOperationsParameters = Compute<ChainIdParameter & {
  operations: readonly GaslessSignedOperationInput[];
  /** Vendor-facing label; fees are derived on-chain from calldata selectors, not from this. */
  operationType: string;
  userAddress: Address; accountId?: string; templateId?: number | null;
  idempotencyKey?: string; metadata?: Record<string, unknown>;
}>;
export function relayInstantOperations(config: Config, parameters: RelayInstantOperationsParameters): Promise<GaslessSubmitReceipt>;
export function getGaslessRequest(config: Config, parameters: Compute<ChainIdParameter & { requestId: string; service?: GaslessService }>): Promise<GaslessRequest>;
export function getGaslessRequestTransactions(config: Config, parameters: …): Promise<readonly GaslessRequestTransaction[]>;
/** Await a request to broadcast or terminal. Honors AbortSignal; throws only on timeout/abort. */
export function waitForGaslessRequest(config: Config, parameters: Compute<ChainIdParameter & {
  requestId: string; service?: GaslessService; until?: "broadcast" | "terminal";
  timeoutMs?: number; queuedPollMs?: number; submittedPollMs?: number; signal?: AbortSignal;
}>): Promise<GaslessRequest>;

// ───────── nonce + fee ─────────
/** InstantLayer replay nonce. Sign with `nonce + 1`; read immediately before signing. */
export function getInstantLayerNonce(config: Config, parameters: Compute<ChainIdParameter & { account: Address }>): Promise<bigint>;
/** GaslessLayer quote for the exact operations about to be relayed. */
export function getGaslessOperationalFeeQuote(config: Config, parameters: Compute<ChainIdParameter & {
  account: Address; operations: readonly SignedOperation[];
}>): Promise<{ amountDue: bigint; freeOpsApplied: bigint; wouldBlockOnQuota: boolean }>;
/** Diamond allowance for (payer, charger). Reduction is delayed — surface reductionReadyAt. */
export function getOperationalFeeAllowance(config: Config, parameters: Compute<ChainIdParameter & { payer: Address; charger?: Address }>):
  Promise<{ allowance: bigint; pendingAllowance: bigint; reductionReadyAt: bigint; feeMultiplier: bigint }>;
/** Grant the charger an allowance, relayed (there is no wallet-paid path — executeBatch is relayer-only). */
export function relayApproveOperationalFee(config: Config, parameters: Compute<ChainIdParameter & FromParameter & {
  account: Address; charger?: Address; allowance?: bigint; feeMultiplier?: bigint; idempotencyKey?: string;
}>): Promise<GaslessSubmitReceipt>;

// ───────── delegation (now an ordinary operation) ─────────
export function relayGrantDelegation(config: Config, parameters: Compute<ChainIdParameter & FromParameter & {
  account: Address; delegatedSigner: Address; selectors: readonly Hex[]; expiryTimestamp: bigint; idempotencyKey?: string;
}>): Promise<GaslessSubmitReceipt>;

// ───────── gasless wallet ─────────
export interface GaslessWalletCall { target: Address; value: bigint; data: Hex }
export const GASLESS_WALLET_EXECUTE_SELECTOR: "0x3f707e6b";
export const GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR: "0x1dccecab";
export function getGaslessWalletAddress(config: Config, parameters: Compute<ChainIdParameter & { owner: Address }>): Promise<Address>; // throws on zero
export function getGaslessWalletNonce(config: Config, parameters: Compute<ChainIdParameter & { account: Address }>): Promise<bigint>;
export function gaslessWalletExecute(config: Config, parameters: Compute<ChainIdParameter & FromParameter & {
  owner?: Address; calls: readonly GaslessWalletCall[]; deadline?: bigint; idempotencyKey?: string;
}>): Promise<GaslessSubmitReceipt>;

// ───────── deposits ─────────
export function getGaslessDepositPolicy(config: Config, parameters: Compute<ChainIdParameter & { owner: Address }>): Promise<GaslessDepositPolicy>;
export interface GaslessDepositPolicy {
  depositAddress: Address; collateralTokenAddress: Address; depositFee: bigint; minimumDeposit: bigint;
  /** max(minimumDeposit, depositFee + 1n) — the amount that actually settles. */ settlementMinimum: bigint;
}
/** isolationType and singleVAMode are REQUIRED — product-dependent (lowcap: MARKET_DIRECTION + singleVAMode true; majors differ). The vendor's server defaults (CUSTOM, false) would be silently wrong for both products, so the SDK forces the choice. */
export interface GaslessDepositAccountData {
  name: string; isolationType: SubAccountIsolationType; singleVAMode: boolean; metadata?: Hex;
}
export function settleGaslessDepositNewAccount(config: Config, parameters: Compute<ChainIdParameter & {
  wallet: Address; affiliate: Address; accountData: GaslessDepositAccountData; idempotencyKey?: string; metadata?: Record<string, unknown>;
}>): Promise<GaslessDepositSubmitReceipt>;
/** Deposit 202s are richer than operation 202s (live OpenAPI). */
export interface GaslessDepositSubmitReceipt {
  requestId: string; status: GaslessRequestStatus;
  depositAddress: Address; observedAmount: bigint; paidFee: bigint; creditedAmount: bigint;
}
export function settleGaslessDepositExistingAccount(config: Config, parameters: Compute<ChainIdParameter & {
  wallet: Address; subAccount: Address; idempotencyKey?: string; metadata?: Record<string, unknown>;
}>): Promise<GaslessSubmitReceipt>;

// ───────── native gas top-up — OUT OF SCOPE this phase (product decision).
// The endpoint exists on the live service; the flow is documented in the docs module
// with a "not yet implemented" note. No exports ship.

// ───────── errors / fallback ─────────
export const GASLESS_NOT_CONFIGURED, GASLESS_NOT_RELAYABLE, GASLESS_INSTANCE_MISMATCH,
  GASLESS_RELAY_SUBMIT_FAILED, GASLESS_SUBMIT_UNCONFIRMED, GASLESS_RELAY_REJECTED,
  GASLESS_RELAY_REVERTED, GASLESS_RELAY_FAILED, GASLESS_BROADCAST_TIMEOUT,
  GASLESS_FEE_UNAFFORDABLE, GASLESS_WALLET_UNAVAILABLE: string;
/** Definitive pre-broadcast rejection — the only states from which a wallet-paid retry is safe. */
export function isConfirmedGaslessFeeLimitError(err: unknown): boolean;
export function isConfirmedGaslessUnavailableError(err: unknown): boolean;
export function parseGaslessErrorDetail(err: unknown): GaslessErrorDetail | null;
```

`apiKey` is read from chain config inside actions and is never a parameter, so it can never enter a query key.

---

## 4. Before/after samples

**(i) Consumer — zero signature change:**

```tsx
const withdraw = useInitiateWithdraw();
withdraw.mutate({ account, parts });          // identical in both modes; data => { hash, receipt }

// activation is config-only
<SymmioProvider symmioConfig={{
  [SymmioSupportedChainId.ARBITRUM]: {
    addresses: { affiliatesAddress: "0x…" },
    gasless: {
      url: "/api/gasless",                     // browser: own proxy injects the key
      gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
      execution: { mode: "gasless", fallback: "wallet" },
    },
  },
}}>

// …or per call
withdraw.mutate({ account, parts, gasless: true });
withdraw.mutate({ account, parts, gasless: { enabled: true, fallback: "error" } });
```

**(ii) The seam (covers 9 proxied writes):**

```ts
export async function callAsSubAccount(config, parameters) {
  const { account, data, chainId, from } = parameters;
  const callDatas = typeof data === "string" ? [data] : data;
  const { addresses } = config.getChainConfig(chainId);

+ const relayed = await maybeRelayAsGasless(config, {
+   chainId, from, gasless: parameters.gasless, signerAccount: account,
+   calls: callDatas.map((callData) => ({ target: addresses.symmioAddress, callData })),
+ });
+ if (relayed !== null) return relayed;        // the relayer's broadcast tx hash

  const walletClient = await config.getWalletClient({ chainId, from });
  if (shouldSimulateBeforeWrite(config, parameters)) { /* unchanged */ }
  return walletClient.writeContract({ /* unchanged */ });
}
```

**(iii) Explicit relay + terminal-stop polling:**

```tsx
const relay = useRelayInstantOperations();
const [requestId, setRequestId] = useState<string>();

const status = useGaslessRequest({
  requestId: requestId ?? "",
  query: {
    enabled: Boolean(requestId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s && isGaslessRequestTerminal(s)) return false;
      return s === GaslessRequestStatus.SUBMITTED ? 3_000 : 1_500;
    },
  },
});
```

**(iv) Session-key onboarding — delegation is now just an operation:**

```ts
await relayGrantDelegation(config, {
  account: subAccount,
  delegatedSigner: sessionKeyAddress,
  selectors: getInstantTradeRequiredSelectors(config, { chainId }),
  expiryTimestamp,
}); // owner signs EIP-712; the relayer pays the gas
```

**(v) Deposit onboarding:**

```tsx
const { data: policy } = useGaslessDepositPolicy({ owner: address });
const { data: observed } = useCollateralBalance({ account: policy?.depositAddress, query: { enabled: !!policy, refetchInterval: 5_000 } });
const canSettle = policy && observed !== undefined && observed >= policy.settlementMinimum;

const receipt = await settle.mutateAsync({ wallet: address, affiliate: zeroAddress, accountData: { name: "Main", … } });
// poll to terminal, then wait for on-chain readiness — "succeeded" does not mean the account is usable yet.
```

---

## 5. Corner-case behavior matrix

| #   | Scenario                                                                                                                              | Transparent mode                                                                                                                                                                                   | Explicit mode                                                                                                                                                                                                                                              | Error surface                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Submit definitive 4xx (`FEE_POLICY_WOULD_REVERT`, `INSUFFICIENT_ALLOWANCE`, `SIMULATION_REVERTED`, `INVALID_OPERATION_SELECTOR`, 422) | `fallback:"wallet"` → gas-paid path; `"error"` → throw                                                                                                                                             | mutation rejects                                                                                                                                                                                                                                           | `SymmApiError`, `GASLESS_<VENDOR_CODE>`, react kind `api` |
| 2   | Network error / 5xx (ambiguous)                                                                                                       | one retry, **same** idempotency key; then `GASLESS_SUBMIT_UNCONFIRMED`; **never** wallet fallback                                                                                                  | same                                                                                                                                                                                                                                                       | `SymmError("api", …)` carrying the key                    |
| 3   | 202 → `rejected`                                                                                                                      | throw `GASLESS_RELAY_REJECTED`; a fresh manual retry is safe (nothing broadcast, salts single-use)                                                                                                 | terminal in the status hook; no invalidation                                                                                                                                                                                                               | manual `SymmApiError` (`fromAxios` can't fire on 2xx)     |
| 4   | 202 → `submitted` → mined                                                                                                             | returns `tx_hash`; `resolveWriteResult` waits the receipt; invalidation after on-chain reality                                                                                                     | `succeeded` → `invalidateAccountBalances` + flow keys                                                                                                                                                                                                      | none                                                      |
| 5   | 202 → `reverted` / `failed`                                                                                                           | typed errors carrying `txHash` + decoded `contract_revert`                                                                                                                                         | terminal                                                                                                                                                                                                                                                   | manual `SymmApiError`                                     |
| 6   | `queued` forever                                                                                                                      | `GASLESS_BROADCAST_TIMEOUT` + `requestId` after `broadcastTimeoutMs`; consumer keeps watching; never re-submit via wallet                                                                          | hook keeps polling                                                                                                                                                                                                                                         | `SymmError("api", …)`                                     |
| 7   | 404 while polling                                                                                                                     | tolerated up to 3 consecutive times (accept-vs-record race), then rethrown — and a post-accept 404 must **never** trigger fallback                                                                 | same                                                                                                                                                                                                                                                       | `NOT_FOUND` after retries                                 |
| 8   | User rejects the EIP-712 prompt                                                                                                       | viem error passes through; no fallback                                                                                                                                                             | same                                                                                                                                                                                                                                                       | react kind `user-rejected`                                |
| 9   | Nonce race (two concurrent relays, one sub-account)                                                                                   | serialized by the per-`(chainId, signerAccount)` lock; batches carry `n, n+1`                                                                                                                      | callers own their batching; the SDK still validates sequencing                                                                                                                                                                                             | `SIMULATION_REVERTED` if bypassed                         |
| 10  | Instance mismatch (staging key vs production base)                                                                                    | `X-GasLessQ-Protocol-Instance` assertion fails closed on every 2xx                                                                                                                                 | same                                                                                                                                                                                                                                                       | `GASLESS_INSTANCE_MISMATCH`                               |
| 11  | Fee unaffordable / quota exhausted                                                                                                    | pre-flight quote throws `GASLESS_FEE_UNAFFORDABLE` **before** any signature prompt; `wouldBlockOnQuota` is a hard stop                                                                             | `useGaslessFeeQuote` drives the UI                                                                                                                                                                                                                         | typed, pre-signature                                      |
| 12  | Allowance not granted                                                                                                                 | `INSUFFICIENT_ALLOWANCE` at submit → grant via `relayApproveOperationalFee` (owner-signed, `signerAccount = sub-account`) and retry. **No wallet-paid path exists** — grant early                  | same                                                                                                                                                                                                                                                       | row-1                                                     |
| 13  | Allowance revoke                                                                                                                      | `getOperationalFeeAllowance` exposes `pendingAllowance` + `reductionReadyAt`; reduction is delayed on-chain                                                                                        | same                                                                                                                                                                                                                                                       | n/a                                                       |
| 14  | Chain has no gasless block, or a 0.8.5 chain                                                                                          | implicit → wallet path; explicit → throw                                                                                                                                                           | hooks gated by `useSupportsGaslessService`                                                                                                                                                                                                                 | `GASLESS_NOT_CONFIGURED`                                  |
| 15  | Non-relayable write (`approveCollateral`, `depositForAccount`)                                                                        | wallet path always; the type doesn't even accept `gasless`                                                                                                                                         | n/a                                                                                                                                                                                                                                                        | none                                                      |
| 16  | Margin relay without a resolvable parent                                                                                              | dispatcher resolves `AccountLayer.getVirtualAccount(va).parentAccount` (cached); if `isExists` is false → typed error or `gasless.account` override                                                | n/a                                                                                                                                                                                                                                                        | `GASLESS_ACCOUNT_UNRESOLVED`                              |
| 17  | Reload mid-flight                                                                                                                     | `onEvent("accepted")` hands the app `{requestId, protocolInstance, chainId}`; persistence is keyed on all three (a bare requestId is insufficient — the databases are per-instance)                | same recipe                                                                                                                                                                                                                                                | n/a                                                       |
| 18  | Gateway redeploy                                                                                                                      | config constant changes → a release, not a runtime recovery. `getGaslessWalletAddress` returning the zero address is the fail-closed guard                                                         | same                                                                                                                                                                                                                                                       | `GASLESS_WALLET_UNAVAILABLE`                              |
| 19  | Deposit below minimum / extra funds mid-flight                                                                                        | n/a                                                                                                                                                                                                | gate on `settlementMinimum = max(minimumDeposit, depositFee + 1n)`; the whole observed balance settles together; a completed settlement replayed by the same idempotency key does **not** re-check the vault — force a fresh key after any terminal status | `DEPOSIT_BELOW_MINIMUM`                                   |
| 20  | Deposit `succeeded` ≠ account usable                                                                                                  | n/a                                                                                                                                                                                                | poll `getUserSubAccounts` + `balanceOf` until the credited amount is readable                                                                                                                                                                              | n/a                                                       |
| 21  | Wallet-execute signature shape                                                                                                        | n/a                                                                                                                                                                                                | 5-field struct, `GaslessGateway` domain, `verifyingContract` = **layer**, `target` = **wallet**; `flexFields`/`maxUses` appended post-signature                                                                                                            | `InvalidWalletOperationTarget`                            |
| 22  | Delegated wallet execution                                                                                                            | n/a                                                                                                                                                                                                | needs delegations for the sentinel `0x1dccecab` **plus every inner call selector**; fees derive from inner selectors. Unimplemented in the reference — owner-signed only in v1                                                                             | documented limitation                                     |
| 23  | Data hygiene                                                                                                                          | uint256 wire fields are **numbers** (safe-integer guarded); amounts live in `callData`; responses are snake_case + lowercase addresses (`isAddressEqual` compares); request models are `.strict()` | same                                                                                                                                                                                                                                                       | mapper tests                                              |

---

## 6. Phases

1. **Config, availability, ABI completion.** `SymmioGaslessConfig` + `mergeGasless` arm + `resolveGaslessService`/`supportsGaslessService` + `useSupportsGaslessService`; **replace the InstantLayer ABI fragment with the full 53-function ABI**; add `getInstantLayerNonce`. React subpath scaffold (4 synchronized edits). Docs: solvers-and-chains section, `core/gasless/` overview (connection model, instance keys, the browser-proxy recipe), `react/gasless/page.mdx`.
2. **Transport + status.** `wire-types`/`http` (instance base, `/v1` de-dup, instance-header assertion, error mapping)/`errors`/`fallback`; `get-gasless-request`(+`/transactions`), `wait-for-gasless-request` (abortable), `use-gasless-request`. Tests: instance-URL assembly, header-mismatch, 404 tolerance, poll cadence + abort under fake timers.
3. **Flow 1 — relay + fees.** `relay-instant-operations`, the number-wire formatter, `getGaslessOperationalFeeQuote` (GaslessLayer), `getOperationalFeeAllowance` + `approveOperationalFee` (diamond, `symmio-contracts/`), `relayApproveOperationalFee`, nonce lock; matching hooks.
4. **Transparent execution mode** (headline). Properties mixin, relayable map, `dispatch/`, seam edits, VA→parent resolution. Docs: overview section + a Callout on the 13 affected write pages. Tests: the full mode × fallback × relayable × outcome matrix, point-of-no-return, nonce sequencing, `onEvent`. **Confirm the invalidation list with the dev before shipping** (decision.md).
5. **Delegation + gasless wallet.** `relayGrantDelegation`; gateway-domain EIP-712, `gaslessWalletExecute`, wallet address/nonce reads. Tests: `0x3f707e6b` encoding, the 5-field signature vs the 7-field transport payload, wrong-target guard, zero-address guard.
6. **Deposits + apps/web.** Deposit policy reads, both settlements, readiness wait; the reference proxy route handler, demo cards, request storage.
   Phase 3's staging e2e additionally probes an explicit `[approveOperationalFee, <op>]` batch (§8 answer 8) — a pass upgrades the allowance self-heal to in-batch approval as a fast-follow.

**Out of scope (this phase, by product decision or absence of any working example)**: **native gas top-up** (endpoint exists on the live service; docs note it as not yet implemented); automatic in-batch fee approval and the signer-VA billing fallback (pending the phase-3 probe); delegated (session-key) wallet execution; template-id helpers beyond pass-through; an SDK-side persistence interface; LiFi/CCTP bridging (the deposit address is a plain recipient — bridging is the app's); server-side calldata allow-listing (revisit with the team's future key-hiding proxy — §8.1 D).

---

## 7. Docs impact

New `apps/docs/app/core/gasless/` (`_meta.ts`, overview `page.mdx` covering the connection/instance model, the browser-proxy requirement, the two EIP-712 domains, the nonce rule and the fee model, plus one subfolder per method); registration in `app/core/_meta.ts`; new `app/react/gasless/page.mdx` ("Gasless hooks") + `app/react/_meta.ts`; a "Gasless relayer service" section in `app/core/concepts/solvers-and-chains/page.mdx`; a Callout on the 13 write pages touched by phase 4; and an update to `core/instant-layer/grant-delegation` noting the relayed alternative.

---

## 8. Question resolutions (2026-09-04, with the user + live probes)

Revision 2 listed 15 open questions. The user answered the product ones; the live production OpenAPI documents (public read-only at `{base}/openapi.json`) and direct Arbitrum RPC probes answered the technical ones. Remaining true unknowns moved to §8.1.

1. **Native top-up ABI** — _moot_: native gas top-up is **out of scope for this phase** by product decision. The module documents the flow and reserves names; no implementation ships.
2. **Native top-up nonce** — moot (same).
3. **HyperEVM** — clarified. Gasless requires the perps-core (0.8.6) contract generation — the team note says backward compatibility with old contracts is _intentionally not supported_, and our HyperEVM registry entry is `contractsVersion: "0.8.5"` (the old generation). So gasless **cannot target our current HyperEVM deployment**, regardless of instance names existing at the vendor. Each gasless chain also needs its own GaslessLayer contract address in config (it is a separate per-deployment contract — Arbitrum's is known; HyperEVM's is not). **v1 ships Arbitrum-only**; HyperEVM joins when its contracts are upgraded to perps-core and a GaslessLayer address is provided. The `contractsVersion === "0.8.6"` gate in `resolveGaslessService` enforces this mechanically.
4. **Arbitrum InstantLayer drift** — **resolved on-chain**. The GaslessLayer exposes an `instantLayer()` getter: the staging gateway (`0x16d448C8…`) returns `0x473468D6B25D1639Ba96A933556dB937283D803b`, the production gateway (`0x8347953D…`) returns `0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132`. Our registry's `0xDBc6DAe3…` is **not** the InstantLayer either gateway verifies against — gasless operations signed with our current registry value would fail signature verification at the gateway. Both `0xDBc6…` and `0x473468…` are live and point at the same diamond/AccountLayer, so the solver may still run the old one today (the team note says the vendor's staging contracts converge "by tomorrow"). Action: gasless always derives its InstantLayer domain from the **gateway-coherent** address; update the registry `instantLayerAddress` to `0x473468D6…` once solver staging converges (team to confirm timing). The gateway also exposes `accountLayer()` — both getters go into the SDK's GaslessLayer ABI, and `resolveGaslessService` can optionally assert config coherence against them.
5. **Key distribution** — decided: **env-var-supplied key for now** (consumer reads env, passes `apiKey` into config — exactly the optional-`apiKey` design); later the team will provide a proxy service that hides the key, which the same config supports by pointing `url` at the proxy. No change needed.
6. **CORS** — hope for direct access; if the browser hits CORS, the team will ask the vendor to allow `localhost` + the app origins. Deployment prerequisite only; the SDK is agnostic.
7. **`operationType`** — **resolved from the live production OpenAPI**: a free-form string, 1–128 chars, "workflow label for display, metrics, and idempotency". Not an enum — the reference's 13-value union was its own proxy policy. SDK labels cannot be rejected. (Note it participates in idempotency/dedup — keep labels stable per action.)
8. **In-batch fee approval** — the user expects it to work as documented (fees are collected after the batch executes). Kept out of v1's automatic path (no working example anywhere); phase 3's e2e adds an explicit `[approveOperationalFee, <op>]` batch probe on staging — if it passes, the `INSUFFICIENT_ALLOWANCE` self-heal upgrades from "approve, then resubmit" to "prepend approve into the same batch" as a fast-follow.
9. **Batch limits** — **resolved from the live OpenAPI**: `signedOps` has `minItems: 1` and **no `maxItems`**. The 2-op cap was reference-app proxy policy. Sequential-nonce discipline still applies.
10. **202 body** — **resolved from the live OpenAPI**: `{ request_id (uuid), status, paid_fee, remaining_fee_allowance }` — all four **required**, fees as decimal strings. The deposit 202 is richer: `{ request_id, status, deposit_address, observed_amount, paid_fee, credited_amount }` (all required).
11. **Deposit `accountData`** — product-dependent (lowcap = `MARKET_DIRECTION`; majors differ), so the SDK **requires** `isolationType` and `singleVAMode` explicitly (no defaults — the vendor's server-side defaults of `CUSTOM`/`false` would silently be wrong for both products). `metadata` stays optional (`0x`), `symmioCore` is omitted (the gateway overwrites it). JSDoc carries both product examples.

### 8.1 Still open

- **A. HyperEVM enablement** — needs the vendor/team to upgrade HyperEVM contracts to perps-core and hand over that chain's GaslessLayer address + instance mapping (`hyperevm-999-canonical` / `-sandbox`).
- **B. Registry InstantLayer update timing** — apply `0x473468D6…` to the Arbitrum registry once the vendor's staging convergence lands (team note: "due tomorrow"); it affects instant trades, not just gasless, so coordinate with the teammate who owns the Arbitrum chain work.
- **C. Status-poll path discrepancy** — the OpenAPI paths read `/operations/{request_id}` (and `/deposit-settlements/{request_id}`) relative to an instance-scoped `servers` entry, while the vendor chapter and the working reference both poll `{base}/{request_id}`. The SDK follows the working form; confirm with the backend whether both routes are served (one curl with a real key settles it).
- **D. Validation tier** — the reference's ~500-line server-side calldata allow-listing/ownership/rate-limit layer has no SDK home; revisit when the team builds the key-hiding proxy (the SDK could then ship a reusable validator for it). Out of v1.
- **E. Invalidation list** (decision.md mandate) — proposed: transparent mode inherits the existing receipt-driven invalidation; explicit hooks run `invalidateAccountBalances` + flow keys on `succeeded`. Confirm at phase-4 review.
- **F. apps/web core-import rule conflict** — root AGENTS.md Hard Rule 6 vs `apps/web/AGENTS.md`; affects only the demo code.
- **Decided by proposal** (raise objections at review): naming — module `gasless`, `Gasless*` identifiers, `gaslessLayerAddress` in config, EIP-712 domain string kept as the literal `"GaslessGateway"` behind a commented constant.

---

## 9. Critical files

- `packages/trading-core/src/symmio-contracts/symmio/internal/call-as-sub-account.ts` — seam A (9 proxied writes, verified)
- `packages/trading-core/src/symmio-contracts/account-layer/actions/{add-margin,remove-margin}.ts` — seam B (needs VA→parent resolution)
- `packages/trading-core/src/symmio-contracts/abi/v0.8.6/instant-layer.ts` — **3-function fragment; must become the full 53-function ABI** (needs `nonces`)
- `packages/trading-core/src/solvers/instant-open/shared/{eip712,operations}.ts` — reused signing stack (do not modify; always pass an explicit nonce from the gasless path)
- `packages/trading-core/src/core/chains/{types.ts,registry.ts}` + `core/config/merge-chain-config.ts` — config block, Arbitrum gasless entry, mandatory merge arm
- `packages/trading-react/{package.json,vite.config.ts}` + `scripts/verify-packages/published-smoke/{react.tsx,runtime-probe.mjs}` — subpath sync
- Reference (read-only): `Vibe-ui-v2/lib/trading/vibecaps/{gaslessqWallet,gaslessqOperation,gaslessqFallback,operationalFee,instantLayerNonce}.ts`, `Vibe-ui-v2/app/api/gaslessq/_lib/proxy.ts`

## 10. Verification

- Per phase: `pnpm lint`, `pnpm check-types`, package tests, prettier-clean.
- Phase 1: merge-arm absent-key invariant; full-ABI diff against perps-core `version_0.8.6`; `pnpm verify-packages` for the new subpath.
- Phase 2: instance-URL assembly and header-mismatch unit tests; live smoke against staging (`GET {operationBase}/health`) once a key is issued.
- Phase 3: fee-quote and allowance decoding against the live Arbitrum GaslessLayer (read-only, no key needed).
- Phase 4: dispatch-matrix tests with a mocked transport + wallet client; then end-to-end on Arbitrum staging — `initiateWithdraw` with `gasless: true`, asserting the returned hash matches the relayer's broadcast and the receipt lands.
- Phase 5: signature-shape tests (a wallet-op signed with the InstantLayer table must be rejected by the fixture); live wallet-execute on staging.
- Phase 6: deposit wizard walked on staging with a funded test wallet.
- Docs build: `pnpm --filter docs build`.
