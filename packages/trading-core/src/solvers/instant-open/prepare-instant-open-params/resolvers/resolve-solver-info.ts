import type { SolverId } from "../../../../core/chains/types";
import type { Config } from "../../../../core/config";
import { getSolverInfo, type EnigmaSolverInfo } from "../../../get-solver-info";

/** Parameters for {@link resolveSolverInfo}. */
export interface ResolveSolverInfoParameters {
  /** Target chain. */
  chainId?: number;
  /** Target solver. */
  solverId?: SolverId;
  /** Pre-fetched solver info (matches `getSolverInfo` return). When supplied, the fetch is skipped. */
  solverInfo?: EnigmaSolverInfo;
}

/** Return type of {@link resolveSolverInfo}: both static fee legs, `"0"`-defaulted. */
export interface ResolvedSolverStaticFees {
  /** Static solver fee charged per instant open (flat USD decimal string). */
  staticSolverFeeOpen: string;
  /** Static solver close fee provisioned at open (flat USD decimal string). */
  staticSolverFeeClose: string;
}

/**
 * Resolve the solver's static per-trade fees (Enigma `/info`) for the open
 * cost model. A caller-supplied `solverInfo` short-circuits the fetch.
 *
 * **Fail-soft**: any fetch failure — the endpoint is not deployed on every
 * solver yet — resolves both legs to `"0"` instead of blocking the open; an
 * absent static fee means the solver charges none.
 */
export async function resolveSolverInfo(
  config: Config,
  parameters: ResolveSolverInfoParameters,
): Promise<ResolvedSolverStaticFees> {
  let info = parameters.solverInfo;
  if (info === undefined) {
    try {
      info = await getSolverInfo(config, { chainId: parameters.chainId, solverId: parameters.solverId });
    } catch {
      info = {};
    }
  }
  return {
    staticSolverFeeOpen: info.staticSolverFeeOpen ?? "0",
    staticSolverFeeClose: info.staticSolverFeeClose ?? "0",
  };
}
