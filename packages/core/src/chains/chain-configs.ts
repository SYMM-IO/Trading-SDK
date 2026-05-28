import { SymmError } from "../errors";
import { SymmioSupportedChainId } from "./supported-chains";
import type { SymmioChainConfig, SymmioEnvironment } from "./types";

/**
 * Built-in SYMMIO deployment configs keyed by environment and chain ID.
 *
 * @internal
 */
const CHAIN_CONFIGS: Record<SymmioEnvironment, Record<number, SymmioChainConfig>> = {
  production: {
    [SymmioSupportedChainId.HYPER_EVM]: {
      environment: "production",
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
      },
    },
  },
  stage: {
    [SymmioSupportedChainId.HYPER_EVM]: {
      environment: "stage",
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: {
        symmioAddress: "0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB",
        instantLayerAddress: "0xCeE28784EFE6EEaf6da977D3F1d0cf05E62717eB",
        accountLayerAddress: "0x812e98F31A4EfFC09dD82e6e87ff7456151a0dFB",
        affiliatesAddress: "0x98490Efdd691ab58601302F98E1492DC28eCAA56",
        collateralAddress: "0x6aA554A167864027A02051D3F5C553244439B7Fd",
        collateralDecimals: 18,
      },
      subgraphs: {
        analytics:
          "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_analytics/latest/gn",
      },
      solver: {
        name: "Superflow",
        address: "0xf62a670cda28FfAE65eE2a42D6cf6CF05EC5E775",
      },
    },
  },
};

/**
 * Get the complete config for a chain and environment.
 *
 * @param chainId - The chain ID to look up
 * @param environment - The deployment environment ("production" or "stage")
 * @returns The resolved chain config
 * @throws {SymmError} when the chain/environment combo is not supported
 *
 * @example
 * ```ts
 * const config = getChainConfig(SymmioSupportedChainId.HYPER_EVM, "production");
 * console.log(config.addresses.accountLayerAddress);
 * ```
 */
export function getChainConfig(chainId: number, environment: SymmioEnvironment): SymmioChainConfig {
  const envConfigs = CHAIN_CONFIGS[environment];
  const config = envConfigs?.[chainId];

  if (!config) {
    throw new SymmError(`No config registered for chain ${chainId} in ${environment} environment.`);
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
 * Check if a chain/environment combo has a built-in config.
 *
 * @param chainId - The chain ID to check
 * @param environment - The deployment environment
 * @returns `true` if the combo is supported
 */
export function isChainSupported(chainId: number, environment: SymmioEnvironment): boolean {
  return CHAIN_CONFIGS[environment]?.[chainId] !== undefined;
}
