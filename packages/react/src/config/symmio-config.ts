import type {
  SymmioChainConfig,
  SymmioContractAddresses,
  SymmioEnvironment,
  SymmioSolverConfig,
  SymmioSubgraphUrls,
  SymmioSupportedChainId,
} from "@symm-frontier/core";
import type { Address } from "viem";

/**
 * Fully resolved SYMMIO chain configuration after defaults and overrides are merged.
 */
export interface SymmioResolvedChainConfig extends SymmioChainConfig {
  /** Chain id for this configuration (narrowed to supported chains). */
  chainId: SymmioSupportedChainId;
}

/**
 * User-provided SYMMIO SDK configuration.
 */
export interface SymmioClientConfigInput {
  /** Runtime environment used to select default addresses and subgraphs. */
  environment: SymmioEnvironment;
  /** Chain id used to select default addresses and subgraphs. */
  chainId: SymmioSupportedChainId;
  /**
   * Required affiliate address for the integrating app.
   *
   * It overrides the default sheet affiliate address and makes affiliate
   * attribution explicit for every SDK initialization.
   */
  affiliateAddress: Address;
  /** Optional contract address overrides for the selected chain/environment. */
  addresses?: Partial<SymmioContractAddresses>;
  /** Optional subgraph URL overrides for the selected chain/environment. */
  subgraphs?: Partial<SymmioSubgraphUrls>;
  /** Optional solver metadata overrides for the selected chain/environment. */
  solver?: Partial<SymmioSolverConfig>;
}

/**
 * SYMMIO SDK configuration exposed through `SymmioProvider`.
 */
export interface SymmioClientConfig extends SymmioResolvedChainConfig {
  /** Original user-provided config before defaults were resolved. */
  input: SymmioClientConfigInput;
}
