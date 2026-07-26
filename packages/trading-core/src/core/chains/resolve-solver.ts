import { SymmError } from "../../shared/errors/symm-error";
import type { SolverId, SymmioChainConfig, SymmioSolverConfig } from "./types";

/**
 * Resolve a chain's solver config by id. When `solverId` is omitted, the chain's
 * `defaultSolverId` is used. The returned object is the stored
 * {@link SymmioSolverConfig} — the caller already knows the chain and id it
 * asked for, so neither is re-attached.
 *
 * @throws {SymmError} `UNKNOWN_SOLVER` when no solver with that id is configured
 *   for the chain.
 *
 * @internal
 */
export function resolveSolver(chainConfig: SymmioChainConfig, solverId?: SolverId): SymmioSolverConfig {
  const id = solverId ?? chainConfig.defaultSolverId;
  const solver = chainConfig.solvers[id];
  if (!solver) {
    throw new SymmError("config", "UNKNOWN_SOLVER", `Unknown solver id "${id}" for chain ${chainConfig.chainId}.`);
  }

  return solver;
}
