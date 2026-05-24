import { getChainConfig } from "@symm-frontier/core";
import type { SymmioClientConfig, SymmioClientConfigInput } from "./symmio-config";

/**
 * Resolves user-provided SYMMIO config against built-in chain defaults from core.
 */
export function resolveSymmioConfig(input: SymmioClientConfigInput): SymmioClientConfig {
  const defaultConfig = getChainConfig(input.chainId, input.environment);

  return {
    ...defaultConfig,
    chainId: input.chainId,
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
