import { toFiniteNumber } from "@symmio/utils/number";
import { getNotionalCapSymbolId, type ApiNotionalCapBySymbolResponse } from "../../types/generated/enigma-solver";
import type { EnigmaNotionalCap } from "../types";

/**
 * Map a raw Enigma `/notional_cap/{symbolId}` response to {@link EnigmaNotionalCap}.
 * Missing numeric fields default to `0`; the solver-reported `error` string is
 * forwarded verbatim (or `null` when absent). Also used by `getNotionalCapAll`
 * for its per-symbol rows.
 */
export function toEnigmaNotionalCap(raw: ApiNotionalCapBySymbolResponse): EnigmaNotionalCap {
  const r = raw as ApiNotionalCapBySymbolResponse & Record<string, unknown>;
  return {
    kind: "enigma",
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

/**
 * Fetch and normalize one market's notional cap from an **Enigma** solver — the
 * generated Enigma client call plus mapping to {@link EnigmaNotionalCap}.
 *
 * @internal
 */
export async function fetchEnigmaNotionalCap(baseURL: string, symbolId: number): Promise<EnigmaNotionalCap> {
  const response = await getNotionalCapSymbolId(symbolId, { baseURL });
  return toEnigmaNotionalCap(response.data);
}
