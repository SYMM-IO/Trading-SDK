import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getOpenInterestOpenInterestGet, type OpenInterestResponseSchema } from "../types/generated/rasa-solver";

/** Parameters for {@link getSolverOpenInterest}. */
export type GetSolverOpenInterestParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getSolverOpenInterest} — global cap and usage as decimal strings. */
export type GetSolverOpenInterestReturnType = OpenInterestResponseSchema;

/**
 * Fetch the solver's global open interest (`total_cap` / `used`) from the
 * Rasa-only `/open-interest` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain/solver.
 * @returns Global open-interest totals.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getSolverOpenInterest(
  config: Config,
  parameters: GetSolverOpenInterestParameters = {},
): Promise<GetSolverOpenInterestReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "getSolverOpenInterest");
  try {
    const response = await getOpenInterestOpenInterestGet({ baseURL: solver.url });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_OPEN_INTEREST_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_SOLVER_OPEN_INTEREST_FAILED",
      `Failed to fetch solver open interest: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
