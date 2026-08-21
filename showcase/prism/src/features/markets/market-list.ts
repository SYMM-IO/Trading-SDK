import type { Market } from "@symmio/trading-core";

/**
 * Collapse a solver's raw contract-symbol rows into one row per market name.
 *
 * A solver lists the same market many times — Rasa returns roughly 2750 rows
 * for about 690 distinct names, one per fee tier, and nearly every name has a
 * zero-fee row among them. Rendering them raw would fill a picker with
 * duplicates, so this keeps a single row per name: a real (non-zero) fee beats
 * a zero-fee row, and between two of the same kind the cheaper one wins.
 *
 * @param markets Normalized markets from `getMarkets` / `useMarkets`.
 * @returns One market per name, deepest first, alphabetical inside a tier.
 */
export function toMarketList<T extends Market>(markets: readonly T[]): T[] {
  const byName = new Map<string, T>();

  for (const market of markets) {
    if (!market.name || !market.isValid) continue;
    const kept = byName.get(market.name);
    if (!kept || isBetterListing(market, kept)) byName.set(market.name, market);
  }

  return [...byName.values()].sort(byDepthThenName);
}

function isBetterListing(candidate: Market, kept: Market): boolean {
  const candidateFee = Number(candidate.tradingFee);
  const keptFee = Number(kept.tradingFee);

  if (candidateFee === 0) return false;
  if (keptFee === 0) return true;
  return candidateFee < keptFee;
}

/**
 * `maxNotionalValue` is the only size signal the contract-symbols endpoint
 * carries, and solvers assign it in tiers — so this sorts the deepest markets
 * to the top and stays alphabetical inside each tier.
 */
function byDepthThenName(a: Market, b: Market): number {
  return b.maxNotionalValue - a.maxNotionalValue || a.name.localeCompare(b.name);
}
