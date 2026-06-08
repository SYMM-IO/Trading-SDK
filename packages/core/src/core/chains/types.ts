import type { Address } from "viem";

/**
 * Contract addresses for a SYMMIO chain deployment.
 */
export interface SymmioContractAddresses {
  /** Main SYMMIO diamond contract */
  symmioAddress: Address;
  /** InstantLayer contract for instant actions */
  instantLayerAddress: Address;
  /** AccountLayer contract for subaccount management */
  accountLayerAddress: Address;
  /** Affiliates registry contract */
  affiliatesAddress: Address;
  /** Collateral token address (e.g. USDC) */
  collateralAddress: Address;
  /** Decimals of the collateral token */
  collateralDecimals: number;
}

/**
 * Subgraph endpoints for a SYMMIO chain deployment.
 */
export interface SymmioSubgraphUrls {
  /** Analytics subgraph for aggregated data */
  analytics: string;
}

/**
 * Solver configuration for a SYMMIO chain deployment.
 */
export interface SymmioSolverConfig {
  /** Human-readable solver name */
  name: string;
  /** Solver's on-chain address */
  address: Address;
  /** Solver API base URL for fetching markets */
  url: string;
}

/**
 * Supported price-service providers.
 */
export type SymmioPriceServiceType = "enigma";

/**
 * Price-service configuration for a SYMMIO chain deployment.
 */
export interface SymmioPriceServiceConfig {
  /** Price-service provider type */
  type: SymmioPriceServiceType;
  /** Price-service API base URL */
  url: string;
}

/**
 * Complete resolved configuration for a SYMMIO chain deployment.
 */
export interface SymmioChainConfig {
  /** Chain ID */
  chainId: number;
  /** Contract addresses */
  addresses: SymmioContractAddresses;
  /** Subgraph endpoints */
  subgraphs: SymmioSubgraphUrls;
  /** Solver configuration */
  solver: SymmioSolverConfig;
  /** Price-service configuration */
  priceService: SymmioPriceServiceConfig;
}
