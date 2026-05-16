import { DEFAULT_SYMMIO_CHAIN_CONFIGS } from "./default-chain-configs";
import type { SymmioClientConfig, SymmioClientConfigInput } from "./symmio-config";

/**
 * Resolves user-provided SYMMIO config against built-in chain defaults.
 */
export function resolveSymmioConfig(input: SymmioClientConfigInput): SymmioClientConfig {
  const defaultConfig = DEFAULT_SYMMIO_CHAIN_CONFIGS[input.environment]?.[input.chainId];

  if (!defaultConfig) {
    throw new Error(`Unsupported SYMMIO config for environment "${input.environment}" and chain "${input.chainId}"`);
  }

  return {
    ...defaultConfig,
    input,
    addresses: {
      ...defaultConfig.addresses,
      ...input.addresses,
      affiliatesAddress: input.affiliateAddress,
    },
    subgraphs: {
      ...defaultConfig.subgraphs,
      ...input.subgraphs,
    },
    solver: {
      ...defaultConfig.solver,
      ...input.solver,
    },
  };
}
