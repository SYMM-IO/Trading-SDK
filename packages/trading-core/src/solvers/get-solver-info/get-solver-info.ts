import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getInfo } from "../types/generated/enigma-solver";

/**
 * Static solver-fee configuration from the Enigma-only `GET /info` endpoint.
 *
 * A flat camelCase mirror of the wire shape; amounts are USD decimal strings
 * exactly as the solver reports them.
 */
export interface EnigmaSolverInfo {
  /**
   * Configured USD amount charged per instant open, before signed fee-cap
   * adjustments. `undefined` when the solver omits it.
   */
  staticSolverFeeOpen?: string;
  /**
   * Configured USD amount charged per instant close (including each partial
   * close), before signed fee-cap adjustments. `undefined` when the solver
   * omits it.
   */
  staticSolverFeeClose?: string;
}

/** Parameters for {@link getSolverInfo}. */
export type GetSolverInfoParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getSolverInfo}. */
export type GetSolverInfoReturnType = EnigmaSolverInfo;

/**
 * Fetch the solver's general information via the Enigma-only `/info` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain/solver.
 * @returns The solver's static fee configuration ({@link EnigmaSolverInfo}).
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not an `enigma` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getSolverInfo(
  config: Config,
  parameters: GetSolverInfoParameters = {},
): Promise<GetSolverInfoReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getSolverInfo");
  try {
    const response = await getInfo({ baseURL: solver.url });
    return {
      staticSolverFeeOpen: response.data.static_solver_fee_open,
      staticSolverFeeClose: response.data.static_solver_fee_close,
    };
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_INFO_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_SOLVER_INFO_FAILED",
      `Failed to fetch solver info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
