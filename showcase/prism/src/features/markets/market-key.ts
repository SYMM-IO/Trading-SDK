import type { Market } from "@symmio/trading-core";

/**
 * The identifier a solver's per-market endpoints key on.
 *
 * This differs by solver kind and the SDK does not reconcile it, which is a
 * quiet trap: both `/get_market_info` and `/get_funding_info` return a map, and
 * looking up the wrong key yields `undefined` rather than an error.
 *
 * - **Rasa** keys by the market's `name` (`"SOLUSDT"`).
 * - **Enigma** keys by its `symbol` (`"SYMM"`), while the market's `name` is
 *   the decorated `"SYMM::80..5f_SFLOW"`.
 *
 * For `/get_funding_info` this matters even more, because the identifier is
 * also the request filter: asking Enigma for the decorated name returns `{}`,
 * so the funding column silently empties for every lowcap market.
 *
 * @example
 * ```ts
 * useFundingInfo({ chainId, solverId, symbols: [solverMarketKey(market)] });
 * ```
 */
export function solverMarketKey(market: Market): string {
  return market.kind === "enigma" ? market.symbol : market.name;
}
