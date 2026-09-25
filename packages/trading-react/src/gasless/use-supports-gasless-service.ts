"use client";

import { supportsGaslessService, type ConfigParameter } from "@symmio/trading-core";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSupportsGaslessService}. */
export interface UseSupportsGaslessServiceParameters extends ConfigParameter {
  /** Chain to check; defaults to the connected chain. */
  chainId?: number;
}

/**
 * Whether the target chain has a usable **GaslessQ relayer** service. Gasless is
 * chain-level — a chain either carries a `gasless` block or it does not — and it
 * additionally requires the perps-core (`"0.8.6"`) contracts generation.
 * Delegates to core `supportsGaslessService` (non-throwing); gate gasless UI on
 * it so the feature hides where the relayer is unavailable rather than erroring
 * at request time.
 *
 * @example
 * ```tsx
 * const supported = useSupportsGaslessService();
 * if (!supported) return null;
 * ```
 */
export function useSupportsGaslessService(parameters: UseSupportsGaslessServiceParameters = {}): boolean {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return supportsGaslessService(config, { chainId: parameters.chainId ?? chainId });
}
