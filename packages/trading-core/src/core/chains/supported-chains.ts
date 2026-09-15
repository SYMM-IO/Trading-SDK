/**
 * Chain IDs with built-in SYMMIO deployment configs.
 *
 * Use these values when calling SDK functions that require a chain ID.
 * The SDK ships a built-in production config for each supported chain.
 */
export enum SymmioSupportedChainId {
  /** Arbitrum One (chain ID 42161) */
  ARBITRUM = 42161,
  /** Base mainnet (chain ID 8453) */
  BASE = 8453,
}
