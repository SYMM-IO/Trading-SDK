import type {
  SymmioContractAddresses,
  SymmioSolverConfig,
  SymmioSubgraphUrls,
  SymmioSupportedChainId,
} from "@symm-frontier/core";
import type { Address } from "viem";

/**
 * User-provided SYMMIO SDK configuration for SymmioProvider.
 */
export interface SymmioClientConfigInput {
  /** Chain id used to select default addresses and subgraphs. */
  chainId: SymmioSupportedChainId;
  /**
   * Required affiliate address for the integrating app.
   *
   * Overrides the default affiliates address from core config.
   */
  affiliateAddress: Address;
  /** Optional contract address overrides for the selected chain. */
  addresses?: Partial<Omit<SymmioContractAddresses, "affiliatesAddress">>;
  /** Optional subgraph URL overrides for the selected chain. */
  subgraphs?: Partial<SymmioSubgraphUrls>;
  /** Optional solver metadata overrides for the selected chain. */
  solver?: Partial<SymmioSolverConfig>;
}
