import { SymmApiError, SymmError } from "@symm-frontier/core";
import {
  BaseError,
  ContractFunctionRevertedError,
  EstimateGasExecutionError,
  HttpRequestError,
  InsufficientFundsError,
  TimeoutError,
  TransactionExecutionError,
  UserRejectedRequestError,
} from "viem";
import { SymmioRequestError } from "./symmio-request-error";

/**
 * Classify any thrown value into a {@link SymmioRequestError}. Hooks call this
 * inside their `queryFn` / `mutationFn` so consumers always see the same
 * discriminated shape, regardless of which viem error type fired underneath.
 *
 * The order of `walk` matters: a wallet-popup dismissal nests inside a
 * `TransactionExecutionError`, so the rejection check has to consider every
 * level of the cause chain, not just the topmost throw.
 *
 * @param err - The thrown value (typed `unknown` because Promises can reject with anything).
 */
export function normalizeSymmError(err: unknown): SymmioRequestError {
  if (err instanceof SymmioRequestError) return err;

  if (err instanceof SymmApiError) {
    return new SymmioRequestError({
      kind: "api",
      message: err.message,
      code: err.code,
      status: err.status,
      responseData: err.responseData,
      cause: err,
    });
  }

  if (err instanceof SymmError) {
    return new SymmioRequestError({
      kind: "sdk",
      message: err.message,
      code: err.code,
      cause: err,
    });
  }

  const viemErr = findViemError(err);

  if (viemErr) {
    const userRejected = findInCauseChain(viemErr, UserRejectedRequestError);
    if (userRejected) {
      return new SymmioRequestError({
        kind: "user-rejected",
        message: userRejected.shortMessage || "Wallet request was rejected.",
        cause: err,
      });
    }

    const revert = findInCauseChain(viemErr, ContractFunctionRevertedError);
    if (revert) {
      const reason = revert.reason ?? revert.data?.errorName;
      return new SymmioRequestError({
        kind: "contract-revert",
        message: revert.shortMessage || `Contract reverted${reason ? `: ${reason}` : "."}`,
        reason,
        cause: err,
      });
    }

    const insufficient = findInCauseChain(viemErr, InsufficientFundsError);
    if (insufficient) {
      return new SymmioRequestError({
        kind: "insufficient-funds",
        message: insufficient.shortMessage || "Insufficient funds for gas.",
        cause: err,
      });
    }

    const transport =
      findInCauseChain(viemErr, HttpRequestError) ||
      findInCauseChain(viemErr, TimeoutError) ||
      findInCauseChain(viemErr, EstimateGasExecutionError) ||
      findInCauseChain(viemErr, TransactionExecutionError);
    if (transport) {
      return new SymmioRequestError({
        kind: "rpc",
        message: transport.shortMessage || transport.message,
        shortMessage: transport.shortMessage,
        cause: err,
      });
    }

    return new SymmioRequestError({
      kind: "rpc",
      message: viemErr.shortMessage || viemErr.message,
      shortMessage: viemErr.shortMessage,
      cause: err,
    });
  }

  if (err instanceof Error) {
    return new SymmioRequestError({ kind: "unknown", message: err.message, cause: err });
  }

  return new SymmioRequestError({
    kind: "unknown",
    message: typeof err === "string" ? err : "An unknown error occurred.",
    cause: err,
  });
}

/**
 * Walk an error and its `cause` chain looking for a viem `BaseError`. Returns
 * the first one found, or `undefined`.
 *
 * @internal
 */
function findViemError(err: unknown): BaseError | undefined {
  let current: unknown = err;
  let depth = 0;
  while (current && depth < 16) {
    if (current instanceof BaseError) return current;
    if (current instanceof Error && current.cause) {
      current = current.cause;
      depth += 1;
      continue;
    }
    return undefined;
  }
  return undefined;
}

/**
 * Walk a viem `BaseError`'s `walk()` chain looking for a specific subclass.
 *
 * @internal
 */
function findInCauseChain<T extends BaseError>(err: BaseError, ctor: new (...args: never[]) => T): T | undefined {
  const found = err.walk((candidate) => candidate instanceof ctor);
  return found instanceof ctor ? (found as T) : undefined;
}
