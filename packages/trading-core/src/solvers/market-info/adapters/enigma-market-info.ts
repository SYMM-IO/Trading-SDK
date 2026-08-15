import { getGetMarketInfo, type GetGetMarketInfo200 } from "../../types/generated/enigma-solver";
import type { EnigmaMarketInfo, MarketVolume } from "../types";

/**
 * Top-level aggregate keys in Enigma's `/get_market_info` bag. Every other key is
 * a market name whose value is a `{ trading_volume, lifetime_value }` object.
 */
const AGGREGATE_KEYS = new Set<string>(["total_value_24h", "total_lifetime_value"]);

/**
 * Coerce an optional numeric solver field to a finite `number`, defaulting to
 * `0`. Enigma's volume bag is untyped in the OpenAPI spec but the running solver
 * may serve numbers or decimal strings, so accept both.
 */
function toNumber(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Map Enigma's flat `/get_market_info` bag into {@link EnigmaMarketInfo},
 * splitting the top-level aggregate totals from the per-market volume rows.
 */
export function toEnigmaMarketInfo(raw: GetGetMarketInfo200): EnigmaMarketInfo {
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
    kind: "enigma",
    markets,
    totalValue24h: toNumber(raw.total_value_24h),
    totalLifetimeValue: toNumber(raw.total_lifetime_value),
  };
}

/**
 * Fetch and normalize market info from an **Enigma** solver — the generated
 * client call plus mapping to {@link EnigmaMarketInfo}.
 *
 * @internal
 */
export async function fetchEnigmaMarketInfo(baseURL: string): Promise<EnigmaMarketInfo> {
  const response = await getGetMarketInfo({ baseURL });
  return toEnigmaMarketInfo(response.data);
}
