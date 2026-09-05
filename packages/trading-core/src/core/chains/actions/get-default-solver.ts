import { resolveSolver } from "../resolve-solver";
import type { SymmioResolvedSolver } from "../types";
import { getChainConfig } from "./get-chain-config";

/**
 * Get the built-in default solver config for a chain.
 *
 * Mirrors {@link getChainConfig} for the solver dimension: it returns the chain's
 * `defaultSolverId` solver. Consumers override or extend a chain's solvers via
 * `createConfig({ symmioConfig })` and resolve the active one with
 * `config.getSolver({ chainId, solverId })`.
 *
 * @param chainId - The chain to look up the default solver for.
 * @returns The chain's default solver config.
 * @throws {SymmError} when the chain is unsupported or its default solver is
 *   not configured.
 *
 * @example
 * ```ts
 * const solver = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM);
 * console.log(solver.url); // "https://solver.enigma.bz/api"
 * ```
 */
export function getDefaultSolver(chainId: number): SymmioResolvedSolver {
  return resolveSolver(getChainConfig(chainId));
}
