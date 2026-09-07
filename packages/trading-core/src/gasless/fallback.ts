import { SymmApiError } from "../shared/errors/symm-error";
import { parseGaslessErrorDetail } from "./errors";
import { GaslessRequestStatus } from "./types";

/**
 * Vendor codes that mean the gateway's **fee policy** refused the request —
 * daily free quota exhausted, selector blocked, or an insufficient
 * operational-fee allowance.
 */
const GASLESS_FEE_LIMIT_CODES = new Set(["FEE_POLICY_WOULD_REVERT", "INSUFFICIENT_ALLOWANCE"]);

const GASLESS_UNAVAILABLE_STATUSES = new Set([404, 502, 503]);

/**
 * Whether an error is a **definitive fee/quota rejection** — the relay refused
 * the request before any broadcast because the billing account hit its daily
 * quota or lacks allowance. One of only two situations where a wallet-paid
 * retry of the same intent is safe.
 *
 * Requires both the vendor code (`FEE_POLICY_WOULD_REVERT` /
 * `INSUFFICIENT_ALLOWANCE`) and a definitive transport signal (HTTP 409, or a
 * stored record whose status is `rejected`). A matching code on an ambiguous
 * transport failure does **not** qualify — the request may still execute.
 *
 * @param err - Anything caught from a gasless submit, or a polled record error.
 * @returns `true` only for a confirmed pre-broadcast fee/quota rejection.
 */
export function isConfirmedGaslessFeeLimitError(err: unknown): boolean {
  const detail = parseGaslessErrorDetail(err);
  const code = detail?.code;
  if (!code || !GASLESS_FEE_LIMIT_CODES.has(code)) return false;
  if (err instanceof SymmApiError && err.status === 409) return true;

  /**
   * A `rejected` terminal surfaced after acceptance: the workflow record rides
   * in `responseData` (manually-constructed SymmApiError) or the value itself
   * is a record. `rejected` means the worker refused it before any broadcast,
   * so a wallet retry cannot double-execute.
   */
  const body = err instanceof SymmApiError ? err.responseData : err;
  const status = body !== null && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
  return status === GaslessRequestStatus.REJECTED;
}

/**
 * Whether an error means the gasless relay is **definitively unavailable** —
 * an unknown route (404), a down gateway (502/503), before anything was
 * accepted. Callers must pair this with a not-yet-accepted guard: after a 202
 * the workflow exists server-side, and even a 404 while polling (the
 * accept-vs-record race) must never trigger a wallet-paid retry — the relayed
 * transaction may still land, and a wallet duplicate would double-execute.
 *
 * @param err - Anything caught from a gasless submit.
 * @returns `true` for a pre-acceptance 404 / 502 / 503.
 */
export function isConfirmedGaslessUnavailableError(err: unknown): boolean {
  return err instanceof SymmApiError && GASLESS_UNAVAILABLE_STATUSES.has(err.status);
}
