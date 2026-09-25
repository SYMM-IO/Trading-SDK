import { gaslessRevertText, parseGaslessErrorDetail, type GaslessErrorDetail } from "./errors";
import { classifyGaslessHttpStatus } from "./http";
import { GaslessRequestStatus } from "./types";
import { getGaslessUnconfirmedSubmit, readGaslessErrorStatus } from "./unconfirmed-submit";

/**
 * Vendor codes that mean the gateway's **fee policy** refused the request —
 * daily free quota exhausted, selector blocked, or an insufficient
 * operational-fee allowance.
 */
const GASLESS_FEE_LIMIT_CODES = new Set(["FEE_POLICY_WOULD_REVERT", "INSUFFICIENT_ALLOWANCE"]);

/**
 * Revert fragments that identify a **billing-only** simulation failure: the
 * batch itself simulates, and only the fee charge does not.
 *
 * `OperationalFee:` is the GaslessLayer's require-string prefix (balance and
 * allowance shortfalls), `DailyFreeOpsLimitExceeded` is the free-quota revert,
 * and `FeeLimitExceeded` is the caller's own fee cap. Nothing else in a
 * `SIMULATION_REVERTED` is safe to treat this way: an ordinary revert means the
 * operation would have failed on-chain too, and retrying it through the wallet
 * only burns gas on the same revert.
 */
const GASLESS_BILLING_REVERT_FRAGMENTS = ["OperationalFee:", "DailyFreeOpsLimitExceeded", "FeeLimitExceeded"];

function isBillingRevert(detail: GaslessErrorDetail): boolean {
  const text = gaslessRevertText(detail);
  return GASLESS_BILLING_REVERT_FRAGMENTS.some((fragment) => text.includes(fragment));
}

/** The stored workflow status of a record that rides inside an error, if any. */
function recordStatus(err: unknown): unknown {
  const body = typeof err === "object" && err !== null && "responseData" in err ? err.responseData : err;
  return typeof body === "object" && body !== null ? (body as { status?: unknown }).status : undefined;
}

/**
 * Whether an error is a **definitive fee/quota rejection** — the relay refused
 * the request before any broadcast because the billing account hit its daily
 * quota, lacks allowance, or cannot cover the fee. One of only two situations
 * where a wallet-paid retry of the same intent is safe.
 *
 * Three shapes qualify, all of them pre-broadcast:
 *
 * - a fee code (`FEE_POLICY_WOULD_REVERT` / `INSUFFICIENT_ALLOWANCE`) on any
 *   `4xx` — the service answered with a verdict, and a `4xx` is by definition
 *   not an acceptance;
 * - a `400 SIMULATION_REVERTED` whose decoded revert is **billing-specific**
 *   (`OperationalFee: …`, `DailyFreeOpsLimitExceeded`, `FeeLimitExceeded`) —
 *   the operation simulates, only the charge does not;
 * - a stored record that ended `rejected` carrying either of those — the worker
 *   refused it before any broadcast.
 *
 * A matching code on an ambiguous transport failure never qualifies, and
 * neither does an unconfirmed submit: the request may still execute.
 *
 * @param err - Anything caught from a gasless submit, or a polled record error.
 * @returns `true` only for a confirmed pre-broadcast fee/quota rejection.
 *
 * @example
 * ```ts
 * if (isConfirmedGaslessFeeLimitError(err)) await payFromWallet();
 * ```
 */
export function isConfirmedGaslessFeeLimitError(err: unknown): boolean {
  /** An unconfirmed submit may be executing, whatever the last status said. */
  if (getGaslessUnconfirmedSubmit(err) !== null) return false;

  const detail = parseGaslessErrorDetail(err);
  if (!detail) return false;
  const status = readGaslessErrorStatus(err);
  const feeCode = detail.code !== null && GASLESS_FEE_LIMIT_CODES.has(detail.code);

  /** Any `4xx` is a verdict the service reached before accepting anything. */
  if (feeCode && status !== undefined && status >= 400 && status < 500) return true;
  if (detail.code === "SIMULATION_REVERTED" && status === 400 && isBillingRevert(detail)) return true;

  /**
   * A `rejected` terminal surfaced after acceptance: the workflow record rides
   * in `responseData` (manually-constructed SymmApiError) or the value itself
   * is a record. `rejected` means the worker refused it before any broadcast,
   * so a wallet retry cannot double-execute — but only a billing cause makes
   * retrying it from the wallet sensible rather than a second guaranteed revert.
   */
  return recordStatus(err) === GaslessRequestStatus.REJECTED && (feeCode || isBillingRevert(detail));
}

/**
 * Whether an error means the gasless relay is **definitively unavailable** —
 * the gateway refused the request itself, before any service saw it, so
 * nothing was accepted and nothing can execute.
 *
 * Exactly two statuses qualify: `429` (rate limited, dropped at the gateway)
 * and a `503` carrying the gateway's own `{ error }` envelope (its
 * configuration is not ready). Both are reported only after the SDK's own
 * same-key retries are exhausted.
 *
 * **`0`, `502`, `504`, a timeout and a bare `503` never qualify**, however much
 * they look like an outage: the request may have reached the service and been
 * accepted, and a wallet-paid retry would then execute the same intent twice.
 * Those surface as `GASLESS_SUBMIT_UNCONFIRMED` instead — replay them with
 * `resubmitGaslessRequest`. A gateway `404` does not qualify either: it names
 * an unknown or disabled instance, which is a configuration error that a wallet
 * retry papers over.
 *
 * Callers must still pair this with a not-yet-accepted guard: after a `202` the
 * workflow exists server-side, and even a `404` while polling (the
 * accept-vs-record race) must never trigger a wallet-paid retry.
 *
 * @param err - Anything caught from a gasless submit.
 * @returns `true` for a pre-acceptance `429` or gateway `503`.
 */
export function isConfirmedGaslessUnavailableError(err: unknown): boolean {
  if (getGaslessUnconfirmedSubmit(err) !== null) return false;
  const failure = classifyGaslessHttpStatus(err);
  return failure === "rate-limited" || failure === "gateway-not-ready";
}
