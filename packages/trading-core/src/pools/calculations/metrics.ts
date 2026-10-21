/** A numeric value accepted at a legacy listing-service boundary. */
export type PoolMetricValue = string | number | null | undefined;

/** Parse a finite metric without inventing a zero for missing data. */
export function parsePoolMetric(value: PoolMetricValue): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Decode a listing amount that is always 18-decimal scaled. */
export function parseScaledPoolMetric(value: PoolMetricValue): number | undefined {
  const parsed = parsePoolMetric(value);
  return parsed === undefined ? undefined : parsed / 1e18;
}

/** Decode rollout-era amounts that can be plain or 18-decimal scaled. Do not use for known fixed-point balance fields. */
export function parseMixedPoolMetric(value: PoolMetricValue): number | undefined {
  const parsed = parsePoolMetric(value);
  return parsed === undefined ? undefined : Math.abs(parsed) > 1e12 ? parsed / 1e18 : parsed;
}

/** Decode plain-percent or legacy 18-decimal percent fields; the result is already percent, not a fraction. */
export function parsePoolPercent(value: PoolMetricValue): number | undefined {
  const parsed = parsePoolMetric(value);
  return parsed === undefined ? undefined : Math.abs(parsed) > 1_000_000 ? parsed / 1e18 : parsed;
}

/** Select an 18-decimal listing snapshot or an unscaled live metric. Zero is a known value. */
export function selectPoolMetricUsd(
  listing: PoolMetricValue,
  fallback: PoolMetricValue,
  preferFallback = false,
): number | undefined {
  const snapshot = parseScaledPoolMetric(listing);
  const live = parsePoolMetric(fallback);
  return preferFallback ? (live ?? snapshot) : (snapshot ?? live);
}

/** Price-source inputs, independent of any UI model. */
export interface PoolPriceSources {
  markPriceUsd?: number;
  listingPriceUsd?: PoolMetricValue;
  dexPriceUsd?: PoolMetricValue;
}

/** Select a positive live mark, then the listing snapshot, then the already-enriched DEX price. */
export function selectPoolPriceUsd(sources: PoolPriceSources): number | undefined {
  const mark = sources.markPriceUsd;
  return mark != null && Number.isFinite(mark) && mark > 0
    ? mark
    : (parseMixedPoolMetric(sources.listingPriceUsd) ?? parsePoolMetric(sources.dexPriceUsd));
}

/** Select a live fallback cap when supplied, then the 18-decimal listing cap, then DEX cap. */
export function selectPoolMarketCapUsd(
  fallback: number | undefined,
  listing: PoolMetricValue,
  dex: number | undefined,
): number | undefined {
  return fallback != null && Number.isFinite(fallback) && fallback > 0
    ? fallback
    : (parseScaledPoolMetric(listing) ?? dex);
}
