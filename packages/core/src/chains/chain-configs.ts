import { SymmError } from "../errors";
import { SymmioSupportedChainId } from "./supported-chains";
import type { SymmioChainConfig } from "./types";

/**
 * Built-in SYMMIO deployment configs keyed by chain ID.
 *
 * @internal
 */
const CHAIN_CONFIGS: Record<number, SymmioChainConfig> = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    chainId: SymmioSupportedChainId.HYPER_EVM,
    addresses: {
      symmioAddress: "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
      instantLayerAddress: "0x72DBF07457b2712b160F67A85D338F860c1CA620",
      accountLayerAddress: "0x46493c376758Da47823D7E3Ae5d417eA6546eEB3",
      affiliatesAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
      collateralAddress: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
      collateralDecimals: 6,
    },
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn",
    },
    solver: {
      name: "Enigma",
      address: "0x76bc5889c0cfcC20960b0D81F541595d81a95122",
      url: "https://solver.enigma.bz/api",
    },
  },
};

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

/**
 * List all chain IDs with built-in configs.
 *
 * @returns Array of supported chain IDs
 */
export function listSupportedChains(): SymmioSupportedChainId[] {
  return Object.values(SymmioSupportedChainId) as SymmioSupportedChainId[];
}

/**
 * Check if a chain has a built-in config.
 *
 * @param chainId - The chain ID to check
 * @returns `true` if the chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return CHAIN_CONFIGS[chainId] !== undefined;
}
