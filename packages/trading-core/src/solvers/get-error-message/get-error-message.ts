import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getErrorMessageErrorCodesErrorCodeGet, type ErrorCodeResponseSchema } from "../types/generated/rasa-solver";

/** Parameters for {@link getErrorMessage}. */
export type GetErrorMessageParameters = Compute<
  ReadSolverParameter & {
    /** Numeric solver error code to look up. */
    errorCode: number;
  }
>;

/** Return type of {@link getErrorMessage} — a `{ [code]: message }` map for the code. */
export type GetErrorMessageReturnType = ErrorCodeResponseSchema;

/**
 * Look up a single solver error code's human-readable message from the
 * Rasa-only `/error_codes/{error_code}` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Error code plus optional chain/solver.
 * @returns Map of code to message.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getErrorMessage(
  config: Config,
  parameters: GetErrorMessageParameters,
): Promise<GetErrorMessageReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "getErrorMessage");
  try {
    const response = await getErrorMessageErrorCodesErrorCodeGet(parameters.errorCode, { baseURL: solver.url });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ERROR_MESSAGE_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_ERROR_MESSAGE_FAILED",
      `Failed to fetch error message: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
