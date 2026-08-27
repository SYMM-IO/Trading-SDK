import type { SymmioListingConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Parameters for {@link resolveListingService} / {@link supportsListingService}.
 */
export interface ResolveListingServiceParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
}

/**
 * Resolve the Pools **listing backend** for a chain.
 *
 * Listing is **chain-level**: one listing backend is served per chain
 * ({@link SymmioListingConfig}), so there is no solver or capability involved. A
 * chain either carries a `listing` block or it does not. This returns the chain's
 * listing config when present and throws otherwise, so a Pools action fails fast
 * with a typed error instead of hitting a backend that is not there.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain override.
 * @returns The chain's {@link SymmioListingConfig}.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing backend.
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
 * Whether the chain has a usable Pools listing backend — the boolean twin of
 * {@link resolveListingService}. Non-throwing: returns `false` for a chain
 * without a listing backend or an unknown chain. Use it for `enabled` gates and
 * UI so Pools features hide instead of erroring where Pools is unavailable.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain override.
 * @returns `true` when the chain has a listing backend configured.
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
