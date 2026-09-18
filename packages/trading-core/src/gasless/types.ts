import type { Address, Hash } from "viem";

/**
 * Lifecycle status of a GaslessQ relayer request.
 *
 * A request moves `QUEUED → SUBMITTED → SUCCEEDED | REVERTED | FAILED`, or
 * `QUEUED → REJECTED` when the worker's pre-broadcast re-check refuses it.
 *
 * `SUBMITTED` is **not** success — it only means a transaction hash exists.
 * Only `SUCCEEDED` is success.
 */
export enum GaslessRequestStatus {
  /** Accepted by the service; no transaction broadcast yet. */
  QUEUED = "queued",
  /** A transaction was broadcast and `txHash` is stored; the receipt is pending. */
  SUBMITTED = "submitted",
  /** The relayed transaction mined with `status = 1`. */
  SUCCEEDED = "succeeded",
  /** The relayed transaction mined with `status = 0`; all charges rolled back. */
  REVERTED = "reverted",
  /** A service or RPC failure occurred before a successful receipt. */
  FAILED = "failed",
  /** The worker's re-check rejected the request before any broadcast. */
  REJECTED = "rejected",
}

/**
 * The terminal {@link GaslessRequestStatus} values — polling stops here.
 *
 * @example
 * ```ts
 * refetchInterval: (query) => {
 *   const status = query.state.data?.status;
 *   return status && isGaslessRequestTerminal(status) ? false : 1_500;
 * }
 * ```
 */
export const GASLESS_TERMINAL_STATUSES: ReadonlySet<GaslessRequestStatus> = new Set([
  GaslessRequestStatus.SUCCEEDED,
  GaslessRequestStatus.REVERTED,
  GaslessRequestStatus.FAILED,
  GaslessRequestStatus.REJECTED,
]);

/**
 * Whether a {@link GaslessRequestStatus} is terminal (no further polling needed).
 *
 * @param status - The status to check.
 * @returns `true` for `succeeded`, `reverted`, `failed`, and `rejected`.
 */
export function isGaslessRequestTerminal(status: GaslessRequestStatus): boolean {
  return GASLESS_TERMINAL_STATUSES.has(status);
}

/** Default poll cadence while a request is `queued` (service-recommended 1–2 s). */
export const GASLESS_QUEUED_POLL_MS = 1_500;
/** Default poll cadence after a request is `submitted` (service-recommended 3–5 s). */
export const GASLESS_SUBMITTED_POLL_MS = 3_000;

/** The service-recommended poll band for a `queued` request, in ms. */
const QUEUED_POLL_BAND = { minMs: 1_000, maxMs: 2_000 } as const;
/** The service-recommended poll band for a `submitted` request, in ms. */
const SUBMITTED_POLL_BAND = { minMs: 3_000, maxMs: 5_000 } as const;

/**
 * The poll cadence a request's current status calls for, or `false` once it is
 * terminal.
 *
 * Shared by the imperative wait loop and the query factory's `refetchInterval`
 * default so both follow one cadence. Terminal records are immutable, so
 * stopping is not an optimisation — a poll that never stops bills the service
 * forever for an answer that cannot change.
 *
 * The delay is drawn from the service's recommended band rather than fixed —
 * 1–2 s while `queued`, 3–5 s after `submitted`. The jitter is load-bearing on
 * the anonymous gateway: every workflow a page opened at the same moment would
 * otherwise poll in lockstep and spend the shared per-IP budget in bursts.
 *
 * Meant for a loop that sleeps between reads. As a TanStack `refetchInterval`
 * callback it needs a `random` that is stable between renders — TanStack
 * recomputes the callback on every render and restarts the countdown whenever
 * the value changed, so a fresh draw per call never fires. Use
 * `getGaslessRequestQueryOptions`, which seeds the draw from the query's own
 * fetch timestamps, rather than wiring this in by hand.
 *
 * @param status - The last known status, or `undefined` before the first fetch.
 * @param random - Source of randomness in `[0, 1)`. Injectable for deterministic tests.
 * @returns Milliseconds until the next poll, or `false` when terminal.
 *
 * @example
 * ```ts
 * for (let status: GaslessRequestStatus | undefined; ; ) {
 *   const delay = gaslessPollDelay(status);
 *   if (delay === false) break;
 *   await new Promise((resolve) => setTimeout(resolve, delay));
 *   status = (await getGaslessRequest(config, { requestId })).status;
 * }
 * ```
 */
export function gaslessPollDelay(
  status: GaslessRequestStatus | undefined,
  random: () => number = Math.random,
): number | false {
  if (status && isGaslessRequestTerminal(status)) return false;
  const band = status === GaslessRequestStatus.SUBMITTED ? SUBMITTED_POLL_BAND : QUEUED_POLL_BAND;
  return band.minMs + Math.floor(random() * (band.maxMs - band.minMs));
}

/**
 * Which GaslessQ sub-service a request id belongs to. Operations and deposit
 * settlements are stored by different services with different poll URLs, so a
 * request id alone does not identify a workflow — keep the service with it.
 */
export type GaslessService = "operations" | "deposits";

/**
 * What every stored relayer request carries, whichever service stores it.
 *
 * Raw decimal-string amounts are parsed to `bigint`; addresses come back
 * lowercased by the service, so compare case-insensitively.
 */
export interface GaslessRequestBase {
  /** Stable service tracking id — persist it to resume polling after a reload. */
  requestId: string;
  /** Current lifecycle status. */
  status: GaslessRequestStatus;
  /** Broadcast transaction hash, once the worker has submitted one. */
  txHash: Hash | null;
  /** Vendor error code on `rejected` / `reverted` / `failed`, when stored. */
  errorCode: string | null;
  /** Human-readable error message, when stored. */
  errorMessage: string | null;
  /** Idempotency key the request was submitted with, when stored. */
  idempotencyKey: string | null;
  /**
   * The owner address the request is tracked under — `user_address` for an
   * operation relay, `wallet_address` (which means the owner, not a
   * GaslessWallet address) for a deposit settlement. `null` when the record
   * stores none.
   */
  owner: Address | null;
  /**
   * The GaslessWallet ids the request selected, in `signedOps` order for an
   * operation relay and as a single entry for a deposit settlement. Historical
   * records that predate multiple wallets store no ids and normalize to zeros —
   * one per stored operation — because an omitted id means wallet `0`.
   */
  walletIds: readonly bigint[];
  /** When the service stored the request (ISO-8601), when recorded. */
  createdAt: string | null;
  /** When the service last updated the request (ISO-8601), when recorded. */
  updatedAt: string | null;
}

/** A stored request of the `"operations"` service — a relayed InstantLayer batch. */
export interface GaslessOperationRequest extends GaslessRequestBase {
  /** Discriminant: this record lives in the operations service. */
  service: "operations";
  /** The workflow label the submitter attached (`operationType`). */
  operationType: string | null;
  /** The client accounting id the submitter attached, when stored. */
  accountId: string | null;
  /**
   * The fee the service recorded for the request, in the unit the service
   * reports it in (a vendor quote, not an authoritative on-chain charge).
   */
  feeAmountRaw: bigint | null;
}

/** A stored request of the `"deposits"` service — a deposit-address settlement. */
export interface GaslessDepositRequest extends GaslessRequestBase {
  /** Discriminant: this record lives in the deposits service. */
  service: "deposits";
  /** The deterministic deposit address being swept, when stored. */
  depositAddress: Address | null;
  /** The settled wallet's id. A record without one means wallet `0`. */
  walletId: bigint;
  /** Name of the sub-account the settlement credits, for a new-account settlement. */
  accountName: string | null;
  /** Collateral the service observed at the deposit address (token base units). */
  amountRaw: bigint | null;
  /** The deposit fee the service recorded (token base units). */
  feeRaw: bigint | null;
  /** The net credit the service recorded (token base units) — an estimate, not the final credit. */
  creditedRaw: bigint | null;
}

/**
 * One stored relayer request, normalized from the service's snake_case record.
 *
 * A flat per-service union: the two services store different columns, so the
 * shared fields stay on {@link GaslessRequestBase} and each service's own
 * fields live on its variant. Narrow with `request.service`.
 *
 * @example
 * ```ts
 * const request = await getGaslessRequest(config, { requestId, service: "deposits" });
 * if (request.service === "deposits") console.log(request.depositAddress, request.walletId);
 * ```
 */
export type GaslessRequest = GaslessOperationRequest | GaslessDepositRequest;

/**
 * The HTTP 202 acknowledgement returned by an operation relay submit.
 *
 * `paidFee` and `remainingFeeAllowance` are the service's **acceptance-time**
 * figures, passed through as reported by the service with no unit conversion.
 * They describe the request before it executes, so neither is an execution
 * result. The GaslessLayer collects the operational fee only when the
 * relayed batch executes, from the payer resolved at that moment, and a
 * reverted relay charges nothing. For authoritative numbers, read the payer's
 * Core allowance and balance (`getOperationalFeeAllowance`,
 * `getAccountBalanceOf` — both 18-decimal) and reconcile the charge from the
 * transaction receipt's `OperationalFeeRouted` events.
 */
export interface GaslessSubmitReceipt {
  /** Stable service tracking id. Persist it immediately. */
  requestId: string;
  /** Status at acceptance — normally {@link GaslessRequestStatus.QUEUED}. */
  status: GaslessRequestStatus;
  /**
   * The fee the service quoted for the request when it accepted it, as
   * reported by the service. A quote, **not proof that a fee was collected**:
   * the charge happens at execution and can differ, or not happen at all.
   * `null` when the acceptance omitted it or reported an unparseable value —
   * an acceptance is never discarded over a missing amount.
   */
  paidFee: bigint | null;
  /**
   * The service's acceptance-time view of the payer's remaining
   * operational-fee allowance, as reported by the service. It is **not** a
   * post-execution balance and not an authorization guarantee, and it can read
   * `2^256 - 1` even while the payer's Core approval is bounded. Never display
   * it as spendable or unlimited funds; read `getOperationalFeeAllowance`
   * instead. `null` when the acceptance omitted it.
   */
  remainingFeeAllowance: bigint | null;
  /**
   * The idempotency key the request was submitted with — generated by the SDK
   * when the caller passed none. Persist it: resending the byte-identical
   * request under this key is what makes a lost response recoverable.
   */
  idempotencyKey: string;
  /** Protocol instance the request was accepted on, or `null` for a proxy base that names none. */
  protocolInstance: string | null;
  /** The owner address the request is tracked under (the submitted `userAddress`). */
  owner: Address;
  /** The GaslessWallet ids the batch selected, in `signedOps` order — `0n` for ordinary InstantLayer operations. */
  walletIds: readonly bigint[];
}

/**
 * Outcome of one EVM broadcast attempt — the attempt's own lifecycle, which is
 * **not** the request's {@link GaslessRequestStatus}. A request whose first
 * attempt is `reverted` can still end `succeeded` on a later attempt, so read
 * the outcome from the request and use the attempts for diagnosis.
 */
export enum GaslessTransactionAttemptStatus {
  /** Broadcast to the network; no receipt observed yet. */
  SUBMITTED = "submitted",
  /** Mined with `status = 1`. */
  CONFIRMED = "confirmed",
  /** Mined with `status = 0`. */
  REVERTED = "reverted",
  /** Never mined — dropped, replaced, or rejected by the node. */
  FAILED = "failed",
}

/**
 * One EVM broadcast attempt stored for a relayer request, with its receipt
 * outcome when observed.
 *
 * A request can broadcast more than once (a replacement transaction after a
 * stuck nonce or a gas bump), so a hash is not a stable handle on a workflow —
 * {@link GaslessRequestTransaction.requestId} is.
 */
export interface GaslessRequestTransaction {
  /** Attempt row id. */
  id: string;
  /** Transaction hash of this attempt. */
  txHash: Hash | null;
  /** 1-based attempt number. */
  attemptNumber: number;
  /** Attempt outcome. */
  status: GaslessTransactionAttemptStatus;
  /**
   * The request this attempt belongs to (the service's `entity_id`) — the same
   * id `getGaslessRequest` is polled with.
   */
  requestId: string;
  /** The service-side workflow that produced the attempt, e.g. `relay_instant`. */
  workflow: string;
  /**
   * The raw receipt the service stored, as reported, or `null` while none was
   * observed. Untyped on purpose: it is the relayer's node's JSON, not a viem
   * `TransactionReceipt`, and its shape is the service's to change. Read the
   * authoritative receipt from your own client with the attempt's `txHash`.
   */
  receipt: Record<string, unknown> | null;
  /** Stored error code for a failed attempt, when present. */
  errorCode: string | null;
  /** Stored error message for a failed attempt, when present. */
  errorMessage: string | null;
  /** When the service stored the attempt (ISO-8601). */
  createdAt: string | null;
  /** When the service last updated the attempt (ISO-8601). */
  updatedAt: string | null;
}

/**
 * Everything a consumer needs to resume an accepted gasless workflow after a
 * reload: the service, the instance and the identity that owns it.
 *
 * There is no list-by-wallet endpoint, so a request id lost to a reload is
 * unrecoverable — persist this whole shape under
 * `(environment, protocolInstance, service, requestId)`, with the owner and the
 * selected wallet ids, as soon as it arrives.
 */
export interface GaslessAcceptedRequest {
  /** Stable service tracking id. */
  requestId: string;
  /** Which sub-service stores the request (its poll URL and its stream). */
  service: GaslessService;
  /** The chain the request was accepted on. */
  chainId: number;
  /** Protocol-instance key the request was accepted on, or `null` for a proxy base that names none. */
  protocolInstance: string | null;
  /** The idempotency key the request was submitted with. */
  idempotencyKey: string;
  /** The workflow label stored with the request, when the submit carried one. */
  operationType: string | null;
  /** The owner address the request is tracked under. */
  owner: Address;
  /** The GaslessWallet ids the request selected, in `signedOps` order. */
  walletIds: readonly bigint[];
}

/**
 * Lifecycle event emitted by the transparent gasless execution mode (the
 * `execution.onEvent` observer on {@link SymmioGaslessConfig}).
 *
 * `accepted` fires as soon as the service returns a request id — persist
 * `{ requestId, service, protocolInstance, chainId }` there so an in-flight
 * workflow survives a reload (there is no list-by-wallet endpoint).
 * `broadcast` fires when a transaction hash appears, and `terminal` when the
 * request reaches a terminal status.
 */
export type GaslessRelayEvent =
  | ({ type: "accepted" } & GaslessAcceptedRequest)
  | { type: "broadcast"; requestId: string; txHash: Hash; chainId: number }
  | {
      type: "terminal";
      requestId: string;
      status: GaslessRequestStatus;
      txHash: Hash | null;
      chainId: number;
    };

/**
 * The HTTP 202 acknowledgement returned by a deposit settlement submit —
 * richer than the operations receipt: it echoes the swept deposit address and
 * the observed, fee and credited amounts, in the collateral token's base units.
 *
 * The amounts are **acceptance-time estimates**, not the settlement result. The
 * settlement sweeps the wallet's **full** collateral balance when the
 * transaction executes, including anything that arrived after acceptance. The
 * service's estimate deducts only the deposit fee, while the contract also
 * charges the wallet creation fee (`getWalletCreationFee(owner, walletId)` on
 * the GaslessLayer) when the settlement first deploys the wallet. Take the final
 * net credit from the settlement transaction's `WalletDepositSettled` event or
 * the sub-account's balance, never from `creditedAmount`.
 */
export interface GaslessDepositSubmitReceipt {
  /** Stable service tracking id (poll it with `service: "deposits"`). */
  requestId: string;
  /** Status at acceptance — normally {@link GaslessRequestStatus.QUEUED}. */
  status: GaslessRequestStatus;
  /** The deterministic deposit address being swept, as the service echoed it. */
  depositAddress: Address;
  /**
   * The wallet id the service settled, echoed back. An acceptance that omits it
   * means wallet `0`. The settle actions verify it against the requested wallet
   * before returning.
   */
  walletId: bigint;
  /** The owner whose wallet was settled (the submitted `owner`). */
  owner: Address;
  /**
   * Collateral balance the service observed at the deposit address when it
   * accepted the request (token base units). The settlement sweeps whatever
   * balance is there at execution, which can differ. `null` when the
   * acceptance omitted it.
   */
  observedAmount: bigint | null;
  /**
   * The deposit fee in the service's acceptance-time estimate (token base
   * units). It excludes a wallet creation fee. `null` when the acceptance
   * omitted it.
   */
  paidFee: bigint | null;
  /**
   * The net credit the service estimated at acceptance (token base units),
   * with only the deposit fee deducted. Not the final credit: show it as an
   * estimate. `null` when the acceptance omitted it.
   */
  creditedAmount: bigint | null;
  /** The idempotency key the settlement was submitted with — persist it for a byte-identical resend. */
  idempotencyKey: string;
  /** Protocol instance the settlement was accepted on, or `null` for a proxy base that names none. */
  protocolInstance: string | null;
}

/**
 * Where a quoted fee is paid from — mirrors the GaslessLayer's
 * `IGaslessLayer.FeeSource` enum.
 */
export enum GaslessFeeSource {
  /** The payer's SYMMIO (Core) balance, drawn through its operational-fee allowance. Every relayed-operation fee. */
  SYMMIO_ACCOUNT = 0,
  /** Collateral held at a GaslessWallet — deposit-settlement and wallet-withdrawal fees. */
  WALLET_COLLATERAL = 1,
}

/**
 * One operation's charge in a {@link GaslessFeeQuote}. Every amount is **18-decimal**,
 * including fees paid from wallet collateral — rescale to the collateral token's
 * decimals with `core18ToCollateral(amount, quote.collateralDecimals)`, which
 * rounds up, before comparing against a raw token balance.
 */
export interface GaslessFeePayment {
  /**
   * The billed identity: the operation's `signerAccount.addr` for a relayed
   * operation (a virtual account stays here even when its parent pays), or the
   * GaslessWallet for a wallet-collateral payment.
   */
  account: Address;
  /**
   * Who the contract would charge, resolved from current allowances and
   * balances. Show funding and allowance needs per `payer`, not per `account`.
   *
   * A relayed operation bills its billing parent — the parent sub-account of a
   * virtual account, otherwise `account` itself — while the parent's
   * operational-fee allowance and Core balance (free plus allocated) cover its
   * running total in the batch. When they do not, and `account` is a live
   * virtual account that covers the fee at its own fee multiplier, the preview
   * already names that virtual account here. When neither can pay, and for an
   * operation that costs nothing, it stays the parent. A single approval-only
   * operation always names the parent.
   *
   * State changes inside the batch (an approval, a transfer, returned funds) can
   * still move the charge at execution; only the service's simulation resolves
   * that. A wallet-collateral payment names the GaslessWallet.
   */
  payer: Address;
  /** Balance the fee is drawn from. */
  source: GaslessFeeSource;
  /** Operational fee for the operation's selectors after multipliers and the free quota (18-decimal). */
  operationalFee18: bigint;
  /** Deposit-settlement fee (18-decimal). */
  depositFee18: bigint;
  /**
   * One-time fee for deploying a GaslessWallet — any wallet id, wallet `0`
   * included (18-decimal). In a relayed batch it is charged once per undeployed
   * wallet, on the first operation that executes from it, to `payer`'s SYMMIO
   * balance; the free quota and fee multipliers do not reduce it. A
   * wallet-collateral payment deducts it from the wallet's own collateral.
   */
  walletCreationFee18: bigint;
  /** Native gas top-up fee (18-decimal). */
  nativeTopUpFee18: bigint;
  /** Collateral debited to fund a native gas top-up — a debit, not a fee (18-decimal). */
  nativeGasCollateral18: bigint;
}

/**
 * A fee quote from the GaslessLayer's `previewFeeQuote` view — a **preview**
 * of what the relay transaction would charge at `blockNumber`, not a guarantee.
 */
export interface GaslessFeeQuote {
  /** The collateral token fees are denominated in. */
  collateralToken: Address;
  /** The collateral token's decimals, for rescaling the 18-decimal amounts. */
  collateralDecimals: number;
  /**
   * The contract's `block.number` when the quote was computed. On Arbitrum that
   * is the L1 block estimate, not the L2 block number a receipt reports.
   */
  blockNumber: bigint;
  /** Timestamp of that block (seconds). */
  timestamp: bigint;
  /**
   * Whether the quote came from executing the real fee-collection path. Always
   * `false` from `previewFeeQuote` — only the relayer's own simulation is exact,
   * and it can differ (an approval or transfer inside the same batch that changes
   * the fee or its payer, state changing before execution).
   */
  exact: boolean;
  /** One entry per quoted operation (or one wallet-collateral payment), in order. */
  payments: readonly GaslessFeePayment[];
  /** Sum of every payment's fees (18-decimal). */
  totalFee18: bigint;
  /** `totalFee18` plus native gas collateral — the full debit (18-decimal). */
  totalDebit18: bigint;
  /** How many operations the billing accounts' daily free quota covers. */
  freeOpsApplied: bigint;
  /** Whether a native gas top-up would be sponsored. `false` for relayed operations. */
  nativeSponsored: boolean;
}
