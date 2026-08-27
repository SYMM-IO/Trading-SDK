"use client";

import { supportsListingService, type ConfigParameter } from "@symmio/trading-core";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSupportsListingService}. */
export interface UseSupportsListingServiceParameters extends ConfigParameter {
  /** Chain to check; defaults to the connected chain. */
  chainId?: number;
}

/**
 * Whether the target chain has the lowcap **Pools** listing backend. Listing is
 * chain-level — a chain either carries a `listing` block or it does not; there is
 * no solver capability involved. Delegates to core `supportsListingService`
 * (non-throwing); gate the Pools tab on it so the feature hides where it is
 * unavailable rather than erroring at request time.
 *
 * @example
 * ```tsx
 * const supported = useSupportsListingService();
 * if (!supported) return null;
 * ```
 */
export function useSupportsListingService(parameters: UseSupportsListingServiceParameters = {}): boolean {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return supportsListingService(config, { chainId: parameters.chainId ?? chainId });
}
