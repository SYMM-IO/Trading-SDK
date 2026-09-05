import type { SolverId, SymmioPriceServiceConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Parameters for {@link resolvePriceService}.
 */
export interface ResolvePriceServiceParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Solver whose price source to resolve. Defaults to the chain's `defaultSolverId`. */
  solverId?: SolverId;
}

/**
 * Resolve the price service serving a solver: its own `priceService` when set,
 * otherwise the chain-level default.
 *
 * This is the single resolution point for the whole price layer — every price
 * action and watcher goes through it, so future per-solver infrastructure
 * overrides land here without touching call sites.
 *
 * A chain with no solver configured for the resolved id falls back to the
 * chain-level price service rather than throwing. That keeps solver-less chains
 * and price-only consumers working exactly as they did before the price provider
 * became a solver-scoped concern.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver overrides.
 * @returns The resolved price-service configuration.
 * @throws {SymmError} `UNSUPPORTED_CHAIN` when the chain is not configured.
 *
 * @internal
 */
export function resolvePriceService(
  config: Config,
  parameters: ResolvePriceServiceParameters = {},
): SymmioPriceServiceConfig {
  const chainConfig = config.getChainConfig(parameters.chainId);

  try {
    const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
    return solver.priceService ?? chainConfig.priceService;
  } catch (err) {
    // A chain may legitimately have no solver (or none for the requested id)
    // while still serving prices. Only an unknown solver is recoverable here —
    // anything else (e.g. an unsupported chain) is a real config error.
    if (err instanceof SymmError && err.code === "UNKNOWN_SOLVER") return chainConfig.priceService;
    throw err;
  }
}
