import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { readyCheckReadyzGet, type ReadinessResponseSchema } from "../types/generated/rasa-solver";

/** Parameters for {@link getSolverReadiness}. */
export type GetSolverReadinessParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getSolverReadiness}. */
export type GetSolverReadinessReturnType = ReadinessResponseSchema;

/**
 * Check the solver's availability via the Rasa-only `/readyz` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain/solver.
 * @returns `{ isReady }`.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getSolverReadiness(
  config: Config,
  parameters: GetSolverReadinessParameters = {},
): Promise<GetSolverReadinessReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "getSolverReadiness");
  try {
    const response = await readyCheckReadyzGet({ baseURL: solver.url });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_READINESS_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_SOLVER_READINESS_FAILED",
      `Failed to fetch solver readiness: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
