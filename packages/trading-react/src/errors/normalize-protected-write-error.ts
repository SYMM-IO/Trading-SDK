import {
  getTimelockBatchRecovery,
  getTimelockExecutionRecovery,
  TimelockBatchExecutionError,
  TimelockExecutionError,
  type TimelockAuthorization,
  type TimelockBatchAuthorization,
} from "@symmio/trading-core";
import { normalizeSymmError } from "./normalize-symm-error";

/** Preserve the exact approval, calldata and hash if confirmation fails. */
export function normalizeProtectedWriteError(
  error: unknown,
  authorization?: TimelockAuthorization | TimelockBatchAuthorization,
) {
  if (authorization && "calls" in authorization) {
    const recovery = getTimelockBatchRecovery(authorization);
    return normalizeSymmError(
      recovery ? new TimelockBatchExecutionError(recovery.approvals, recovery.callDatas, error, recovery.hash) : error,
    );
  }
  const recovery = authorization ? getTimelockExecutionRecovery(authorization) : undefined;
  return normalizeSymmError(
    recovery ? new TimelockExecutionError(recovery.approval, recovery.callData, error, recovery.hash) : error,
  );
}
