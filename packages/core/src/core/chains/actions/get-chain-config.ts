import { SymmError } from "../../../shared/errors/symm-error";
import { CHAIN_CONFIGS } from "../registry";
import type { SymmioChainConfig } from "../types";

/**
 * Get the complete config for a chain.
 *
 * @param chainId - The chain ID to look up
 * @returns The resolved chain config
 * @throws {SymmError} when the chain is not supported
 *
 * @example
 * ```ts
 * const config = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
 * console.log(config.addresses.accountLayerAddress);
 * ```
 */
export function getChainConfig(chainId: number): SymmioChainConfig {
  const config = CHAIN_CONFIGS[chainId];

  if (!config) {
    throw new SymmError(`No config registered for chain ${chainId}.`);
  }

  return config;
}
