import { SymmioSupportedChainId } from "../supported-chains";

/**
 * List all chain IDs with built-in configs.
 *
 * @returns Array of supported chain IDs
 */
export function listSupportedChains(): SymmioSupportedChainId[] {
  /**
   * Numeric enums carry a reverse mapping (`{ 999: "HYPER_EVM", HYPER_EVM: 999 }`),
   * so `Object.values` yields the string keys too — keep only the chain ids.
   */
  return Object.values(SymmioSupportedChainId).filter(
    (value): value is SymmioSupportedChainId => typeof value === "number",
  );
}
