import { getChainConfig, type SymmioChainConfig, type SymmioSupportedChainId } from "../chains";
import type { SymmioConfigOverrides } from "./types";

/**
 * Merge built-in chain defaults with user-provided overrides.
 *
 * @param chainId - Target chain
 * @param overrides - Optional partial config to merge on top of defaults
 * @returns Fully resolved chain config
 *
 * @internal
 */
export function resolveConfig(chainId: SymmioSupportedChainId, overrides?: SymmioConfigOverrides): SymmioChainConfig {
  const defaultConfig = getChainConfig(chainId);

  return {
    ...defaultConfig,
    addresses: {
      ...defaultConfig.addresses,
      ...overrides?.addresses,
    },
    subgraphs: {
      ...defaultConfig.subgraphs,
      ...overrides?.subgraphs,
    },
    solver: {
      ...defaultConfig.solver,
      ...overrides?.solver,
    },
  };
}
