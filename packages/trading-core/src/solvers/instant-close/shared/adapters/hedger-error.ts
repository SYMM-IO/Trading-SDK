import { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../../../../shared/errors/symm-error";

/**
 * Normalize a failure from an instant-close hedger POST into a typed SDK error.
 * An already-typed {@link SymmError} (e.g. a Rasa `successful: false` rejection)
 * passes through untouched; an axios transport error becomes a
 * {@link SymmApiError}; anything else a generic {@link SymmError}. Shared by
 * every per-kind close adapter so consumers see one error shape.
 */
export function toSendInstantCloseError(err: unknown, solverUrl: string): SymmError {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) {
    return SymmApiError.fromAxios(err, { code: "SEND_INSTANT_CLOSE_FAILED", baseURL: solverUrl });
  }
  return new SymmError(
    "api",
    "SEND_INSTANT_CLOSE_FAILED",
    `Failed to send instant close: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
