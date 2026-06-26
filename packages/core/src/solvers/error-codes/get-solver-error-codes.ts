import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getErrorCodes } from "../types/generated/enigma-solver";

/**
 * Parameters for {@link getSolverErrorCodes}.
 */
export type GetSolverErrorCodesParameters = Compute<ChainIdParameter>;

/**
 * Return type of {@link getSolverErrorCodes}: a flat map of numeric solver error
 * code to its human-readable message. Use it to resolve the `errorCode` reported
 * on a failed open/close notification.
 */
export type GetSolverErrorCodesReturnType = Record<number, string>;

/**
 * Fetch the solver's error-code → message map from the chain's `/error_codes`
 * endpoint. The solver base URL is resolved from `config` per call, so multiple
 * chains never clobber each other.
 *
 * The map is effectively static for a session; cache it freely (the matching
 * {@link getSolverErrorCodesQueryOptions} defaults to `staleTime: Infinity`).
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id (defaults to the config's default chain).
 * @returns A `{ [code: number]: message }` map of solver error codes.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const codes = await getSolverErrorCodes(config, {});
 * console.log(codes[2000]); // "Insufficient balance"
 * ```
 */
export async function getSolverErrorCodes(
  config: Config,
  parameters: GetSolverErrorCodesParameters = {},
): Promise<GetSolverErrorCodesReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  return fetchSolverErrorCodes(solver.url);
}

/**
 * Call the solver's `/error_codes` endpoint with a per-call base URL.
 *
 * @internal
 */
async function fetchSolverErrorCodes(baseURL: string): Promise<GetSolverErrorCodesReturnType> {
  try {
    const response = await getErrorCodes({ baseURL });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_ERROR_CODES_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_SOLVER_ERROR_CODES_FAILED",
      `Failed to fetch solver error codes: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
