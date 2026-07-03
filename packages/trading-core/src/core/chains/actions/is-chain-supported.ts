import { CHAIN_CONFIGS } from "../registry";

/**
 * Check if a chain has a built-in config.
 *
 * @param chainId - The chain ID to check
 * @returns `true` if the chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return CHAIN_CONFIGS[chainId] !== undefined;
}
