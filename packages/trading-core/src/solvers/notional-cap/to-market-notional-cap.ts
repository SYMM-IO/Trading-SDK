import type { ApiNotionalCapBySymbolResponse } from "../types/generated/enigma-solver";
import type { MarketNotionalCap } from "./types";

/**
 * Coerce an optional numeric solver field to a finite `number`, defaulting to
 * `0`. The endpoint declares these fields as `number` in the OpenAPI spec but
 * the running solver actually returns them as **decimal strings** (e.g.
 * `"112258.5966..."`), so we accept both shapes and parse strings via `Number`.
 */
function toNumber(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Map the generated `ApiNotionalCapBySymbolResponse` into the SDK's
 * {@link MarketNotionalCap}. Missing numeric fields default to `0`; the
 * solver-reported `error` string is forwarded verbatim (or `null` when absent).
 */
export function toMarketNotionalCap(raw: ApiNotionalCapBySymbolResponse): MarketNotionalCap {
  const r = raw as ApiNotionalCapBySymbolResponse & Record<string, unknown>;
  return {
    symbolId: toNumber(r.symbol_id as number | string | undefined),
    symbol: typeof r.symbol === "string" ? r.symbol : "",
    totalCap: toNumber(r.total_cap as number | string | undefined),
    used: toNumber(r.used as number | string | undefined),
    availableToLong: toNumber(r.available_to_long as number | string | undefined),
    availableToShort: toNumber(r.available_to_short as number | string | undefined),
    openInterest: toNumber(r.open_interest as number | string | undefined),
    price: toNumber(r.price as number | string | undefined),
    tokenBalance: toNumber(r.token_balance as number | string | undefined),
    usdcBalance: toNumber(r.usdc_balance as number | string | undefined),
    error: typeof r.error === "string" && r.error.length > 0 ? r.error : null,
  };
}
