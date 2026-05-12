import type { Address } from "viem";

/**
 * Runtime environment used to select default SYMMIO deployment metadata.
 */
export type SymmioEnvironment = "production" | "stage";

/**
 * Chain ids supported by the current VibeCaps SDK phase.
 */
export enum SymmioSupportedChainId {
  /** HyperEVM main chain id. */
  HYPER_EVM = 999,
}

/**
 * Contract addresses required by SYMMIO VibeCaps flows on a chain.
 */
export interface SymmioContractAddresses {
  /** SYMMIO protocol diamond/proxy contract address. */
  symmioAddress: Address;
  /** Instant layer contract address used by instant trading flows. */
  instantLayerAddress: Address;
  /** Account layer contract address used for Vibe account operations. */
  accountLayerAddress: Address;
  /** Affiliate contract address. This must always resolve during initialization. */
  affiliatesAddress: Address;
  /** Optional backed withdraw bridge address. Stage currently does not have one. */
  backedWithdrawBridgeAddress?: Address;
  /** Collateral token address used by VibeCaps flows. */
  collateralAddress: Address;
  /** Collateral token decimals for amount conversion. */
  collateralDecimals: number;
}

/**
 * Subgraph endpoints used to read indexed SYMMIO/Vibe data.
 */
export interface SymmioSubgraphUrls {
  /** Analytics subgraph endpoint. */
  analytics: string;
  /** Events subgraph endpoint. */
  events: string;
  /** Vibe application subgraph endpoint. */
  vibe: string;
}

/**
 * Solver metadata for the selected environment and chain.
 */
export interface SymmioSolverConfig {
  /** Human-readable solver name from deployment metadata. */
  name: string;
  /** Solver address used by trading flows. */
  address: Address;
}

/**
 * Fully resolved SYMMIO chain configuration after defaults and overrides are merged.
 */
export interface SymmioResolvedChainConfig {
  /** Runtime environment for this configuration. */
  environment: SymmioEnvironment;
  /** Chain id for this configuration. */
  chainId: SymmioSupportedChainId;
  /** Resolved contract addresses. */
  addresses: SymmioContractAddresses;
  /** Resolved subgraph endpoints. */
  subgraphs: SymmioSubgraphUrls;
  /** Resolved solver metadata. */
  solver: SymmioSolverConfig;
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
