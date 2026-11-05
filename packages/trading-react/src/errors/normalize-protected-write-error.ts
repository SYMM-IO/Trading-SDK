import {
  getTimelockBatchRecovery,
  getTimelockExecutionRecovery,
  TimelockBatchExecutionError,
  TimelockExecutionError,
  type TimelockAuthorization,
  type TimelockBatchAuthorization,
} from "@symmio/trading-core";
import { TransactionRevertedError } from "../transactions/resolve-write-result";
import { normalizeSymmError } from "./normalize-symm-error";
import { SymmioRequestError } from "./symmio-request-error";

// A framework-level retry must not replace the confirmed outcome of the first
// attempt with the SDK's later "already submitted" guard error.
const confirmationErrors = new WeakMap<TimelockAuthorization | TimelockBatchAuthorization, SymmioRequestError>();

/** Preserve the exact approval, calldata and hash if confirmation fails. */
export function normalizeProtectedWriteError(
  error: unknown,
  authorization?: TimelockAuthorization | TimelockBatchAuthorization,
) {
  const previous = authorization && confirmationErrors.get(authorization);
  if (previous && (error instanceof TimelockExecutionError || error instanceof TimelockBatchExecutionError))
    return previous;
  if (authorization && "calls" in authorization) {
    const recovery = getTimelockBatchRecovery(authorization);
    if (recovery) {
      const result = preserveClassification(
        error,
        new TimelockBatchExecutionError(recovery.approvals, recovery.callDatas, error, recovery.hash),
      );
      confirmationErrors.set(authorization, result);
      return result;
    }
    return error instanceof TimelockBatchExecutionError
      ? preserveClassification(error.cause, error)
      : normalizeSymmError(error);
  }
  const recovery = authorization ? getTimelockExecutionRecovery(authorization) : undefined;
  if (recovery && authorization) {
    const result = preserveClassification(
      error,
      new TimelockExecutionError(recovery.approval, recovery.callData, error, recovery.hash),
    );
    confirmationErrors.set(authorization, result);
    return result;
  }
  return error instanceof TimelockExecutionError
    ? preserveClassification(error.cause, error)
    : normalizeSymmError(error);
}

function preserveClassification(error: unknown, recovery: Error): SymmioRequestError {
  const underlying = normalizeSymmError(error);
  if (underlying instanceof TransactionRevertedError) {
    const reverted = new TransactionRevertedError({ hash: underlying.hash, receipt: underlying.receipt });
    reverted.cause = recovery;
    return reverted;
  }
  return new SymmioRequestError({ ...underlying, message: underlying.message, cause: recovery });
}
