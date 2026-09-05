/**
 * Chain IDs with built-in SYMMIO deployment configs.
 *
 * Use these values when calling SDK functions that require a chain ID.
 * The SDK ships production and staging configs for each supported chain.
 */
export enum SymmioSupportedChainId {
  /** HyperEVM mainnet (chain ID 999) */
  HYPER_EVM = 999,
  /** Base mainnet (chain ID 8453) */
  BASE = 8453,
}
