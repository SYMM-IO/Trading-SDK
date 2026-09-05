import type { Market } from "@symmio/trading-core";

/**
 * Symbols kept out of every picker, mirroring the reference UI's own exclusion
 * list. Both the solver and the reference exchange carry XMR — this is a
 * product call, not a data gap, so it lives in one place and is easy to drop.
 */
const EXCLUDED_SYMBOLS = new Set(["XMR"]);

/**
 * Collapse a solver's raw `/contract-symbols` rows into the one row per market
 * name a picker should offer, ordered so the deepest markets come first.
 *
 * A solver lists the same market many times — Rasa returns ~2750 rows for ~690
 * distinct names, one per fee tier, and nearly every name has a zero-fee row
 * among them. Offering them raw would fill the picker with duplicates, so this
 * keeps a single row per name using the reference UI's rule: prefer a real
 * (non-zero) fee over a zero-fee row, then the cheaper of the two.
 *
 * @param markets - Normalized markets from `getMarkets` / `useMarkets`.
 * @returns One market per name, deepest first and alphabetical within a tier.
 */
export function toMarketPickerList<T extends Market>(markets: readonly T[]): T[] {
  const byName = new Map<string, T>();

  for (const market of markets) {
    if (!market.name || EXCLUDED_SYMBOLS.has(market.symbol)) continue;
    const kept = byName.get(market.name);
    if (!kept || isBetterListing(market, kept)) byName.set(market.name, market);
  }

  return [...byName.values()].sort(byDepthThenName);
}

/**
 * Whether `candidate` should replace `kept` as the row for their shared name:
 * a real fee beats a zero fee, and between two of the same kind the lower fee
 * wins. A fee that does not parse compares as `NaN`, which keeps `kept`.
 */
function isBetterListing(candidate: Market, kept: Market): boolean {
  const candidateFee = Number(candidate.tradingFee);
  const keptFee = Number(kept.tradingFee);

  if (candidateFee === 0) return false;
  if (keptFee === 0) return true;
  return candidateFee < keptFee;
}

/**
 * `maxNotionalValue` is the only size signal `/contract-symbols` carries, and
 * the solver assigns it in tiers — so this sorts majors (BTC, ETH, SOL, the
 * metals) to the top and stays alphabetical inside each tier.
 */
function byDepthThenName(a: Market, b: Market): number {
  return b.maxNotionalValue - a.maxNotionalValue || a.name.localeCompare(b.name);
}
