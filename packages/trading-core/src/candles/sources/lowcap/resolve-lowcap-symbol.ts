import type { EnigmaSymbolInfo } from "../../../price-service/enigma/symbols-info/get-enigma-price-service-symbols-info";

/**
 * Resolve a listed lowcap market by its complete, case-sensitive name.
 * Tickers and truncated address suffixes are not unique market identifiers.
 *
 * @param symbols - Listings from the configured price service.
 * @param marketName - Exact market name, including any `::` suffix.
 * @returns The matching listing with its address unchanged, or undefined.
 * @internal
 */
export function resolveLowcapSymbol(
  symbols: readonly EnigmaSymbolInfo[],
  marketName: string,
): EnigmaSymbolInfo | undefined {
  return symbols.find((symbol) => symbol.name === marketName);
}
