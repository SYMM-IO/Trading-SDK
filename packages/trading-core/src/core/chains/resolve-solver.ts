import { SymmError } from "../../shared/errors/symm-error";
import type { SolverId, SymmioChainConfig, SymmioResolvedSolver } from "./types";

/**
 * Resolve a chain's solver by id. When `solverId` is omitted, the chain's
 * `defaultSolverId` is used. Returns the stored config with its resolved `id`
 * (which is the solver's kind) attached, so callers can dispatch by kind without
 * re-deriving it.
 *
 * @throws {SymmError} `UNKNOWN_SOLVER` when no solver with that id is configured
 *   for the chain.
 *
 * @internal
 */
export function resolveSolver(chainConfig: SymmioChainConfig, solverId?: SolverId): SymmioResolvedSolver {
  const id = solverId ?? chainConfig.defaultSolverId;
  const solver = chainConfig.solvers[id];
  if (!solver) {
    throw new SymmError("config", "UNKNOWN_SOLVER", `Unknown solver id "${id}" for chain ${chainConfig.chainId}.`);
  }

  return { ...solver, id };
}
