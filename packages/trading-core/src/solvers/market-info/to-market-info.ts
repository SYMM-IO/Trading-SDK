import type { GetGetMarketInfo200 } from "../types/generated/enigma-solver";
import type { GetMarketInfoReturnType, MarketVolume } from "./types";

/**
 * Top-level aggregate keys in the `/get_market_info` bag. Every other key is a
 * market name whose value is a `{ trading_volume, lifetime_value }` object.
 */
const AGGREGATE_KEYS = new Set<string>(["total_value_24h", "total_lifetime_value"]);

/**
 * Coerce an optional numeric solver field to a finite `number`, defaulting to
 * `0`. The volume fields are declared as an untyped bag in the OpenAPI spec but
 * the running solver may serve them as numbers or decimal strings, so we accept
 * both and parse strings via `Number`.
 */
function toNumber(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Map the generated `GetGetMarketInfo200` bag into the SDK's
 * {@link GetMarketInfoReturnType}, splitting the top-level aggregate totals from
 * the per-market volume rows. Keys in {@link AGGREGATE_KEYS} become the totals;
 * every other object-valued key becomes a {@link MarketVolume}. Missing numeric
 * fields default to `0`.
 *
 * @param raw - The raw `/get_market_info` response object.
 */
export function toMarketInfo(raw: GetGetMarketInfo200): GetMarketInfoReturnType {
  const markets: MarketVolume[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (AGGREGATE_KEYS.has(key)) continue;
    if (typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    markets.push({
      symbol: key,
      tradingVolume: toNumber(entry.trading_volume),
      lifetimeValue: toNumber(entry.lifetime_value),
    });
  }
  return {
    markets,
    totalValue24h: toNumber(raw.total_value_24h),
    totalLifetimeValue: toNumber(raw.total_lifetime_value),
  };
}
