import type { SolverId, SymmioListingConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Parameters for {@link resolveListingService} / {@link supportsListingService}.
 */
export interface ResolveListingServiceParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Solver to check. Defaults to the chain's `defaultSolverId`. */
  solverId?: SolverId;
}

/**
 * Resolve the Pools **listing backend** for a `{ chainId, solverId }` target.
 *
 * The listing backend is chain-level ({@link SymmioListingConfig}); a solver
 * opts into it via its `listingService` capability. This returns the chain's
 * listing config only when **both** hold — the resolved solver declares
 * `listingService` and the chain carries a `listing` block — and throws
 * otherwise, so a Pools action fails fast with a typed error instead of hitting a
 * backend that is not there.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver overrides.
 * @returns The chain's {@link SymmioListingConfig}.
 * @throws {SymmError} `LISTING_UNSUPPORTED` when the resolved solver does not use the listing service, or `LISTING_NOT_CONFIGURED` when the chain has no listing backend.
 *
 * @example
 * ```ts
 * const { url } = resolveListingService(config, { chainId });
 * ```
 */
export function resolveListingService(
  config: Config,
  parameters: ResolveListingServiceParameters = {},
): SymmioListingConfig {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  if (!solver.capabilities?.listingService) {
    throw new SymmError(
      "config",
      "LISTING_UNSUPPORTED",
      `Pools: solver "${solver.name}" (kind "${solver.id}") does not use the listing service.`,
    );
  }
  const chain = config.getChainConfig(parameters.chainId);
  if (!chain.listing) {
    throw new SymmError(
      "config",
      "LISTING_NOT_CONFIGURED",
      `Pools: chain ${chain.chainId} has no listing backend configured.`,
    );
  }
  return chain.listing;
}

/**
 * Whether the resolved `{ chainId, solverId }` target has a usable Pools listing
 * backend — the boolean twin of {@link resolveListingService}. Non-throwing:
 * returns `false` for a solver that does not use the service, a chain without a
 * listing backend, or an unknown chain/solver. Use it for `enabled` gates and UI
 * so Pools features hide instead of erroring where Pools is unavailable.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver overrides.
 * @returns `true` when a listing backend is configured and the solver uses it.
 *
 * @example
 * ```ts
 * if (supportsListingService(config, { chainId })) showPoolsTab();
 * ```
 */
export function supportsListingService(config: Config, parameters: ResolveListingServiceParameters = {}): boolean {
  try {
    resolveListingService(config, parameters);
    return true;
  } catch {
    return false;
  }
}
