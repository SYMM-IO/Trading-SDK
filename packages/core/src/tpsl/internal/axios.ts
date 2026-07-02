import { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";

/**
 * Normalize any axios / unknown error from a TP/SL handler call into the
 * SDK's error hierarchy. Pass `code` to tag the error for the caller.
 */
export function rethrowTpSlError(err: unknown, parameters: { code: string; baseURL: string }): never {
  if (err instanceof SymmError) throw err;
  if (isAxiosError(err)) {
    throw SymmApiError.fromAxios(err, { code: parameters.code, baseURL: parameters.baseURL });
  }
  throw new SymmError(
    "api",
    parameters.code,
    `TP/SL request failed: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
