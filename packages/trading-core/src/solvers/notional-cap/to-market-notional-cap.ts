import { toFiniteNumber } from "@symmio/utils/number";
import type { ApiNotionalCapBySymbolResponse } from "../types/generated/enigma-solver";
import type { MarketNotionalCap } from "./types";

/**
 * Map the generated `ApiNotionalCapBySymbolResponse` into the SDK's
 * {@link MarketNotionalCap}. Missing numeric fields default to `0`; the
 * solver-reported `error` string is forwarded verbatim (or `null` when absent).
 */
export function toMarketNotionalCap(raw: ApiNotionalCapBySymbolResponse): MarketNotionalCap {
  const r = raw as ApiNotionalCapBySymbolResponse & Record<string, unknown>;
  return {
    symbolId: toFiniteNumber(r.symbol_id),
    symbol: typeof r.symbol === "string" ? r.symbol : "",
    totalCap: toFiniteNumber(r.total_cap),
    used: toFiniteNumber(r.used),
    availableToLong: toFiniteNumber(r.available_to_long),
    availableToShort: toFiniteNumber(r.available_to_short),
    openInterest: toFiniteNumber(r.open_interest),
    price: toFiniteNumber(r.price),
    tokenBalance: toFiniteNumber(r.token_balance),
    usdcBalance: toFiniteNumber(r.usdc_balance),
    error: typeof r.error === "string" && r.error.length > 0 ? r.error : null,
  };
}
