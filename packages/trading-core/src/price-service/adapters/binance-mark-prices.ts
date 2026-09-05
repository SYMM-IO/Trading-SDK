import { fetchBinancePremiumIndexAll, fetchBinancePremiumIndexOne } from "../binance/client";
import type { RawBinancePremiumIndexRow } from "../binance/types";
import type { BinanceMarkPriceTick } from "../types";

/**
 * Normalize a market name for a Binance request.
 *
 * Binance is inconsistent across surfaces — REST `?symbol=` wants uppercase,
 * per-symbol *stream paths* want lowercase — so the SDK collapses it to one
 * rule: uppercase on the request side, case-insensitive matching on the
 * response side. No lowercasing is needed anywhere in this slice, because
 * `!markPrice@arr@1s` carries no symbol in its path.
 *
 * @internal
 */
export function toBinanceSymbol(name: string): string {
  return name.trim().toUpperCase();
}

/**
 * `"::"`-suffixed names are an Enigma/lowcap artifact. They must never be
 * stripped down to a bare ticker and sent to Binance: `FOO::abc` → `FOO` would
 * fabricate a plausible-looking symbol and could return a confidently wrong
 * price for a *different asset* — the worst outcome available on a signing path.
 * They are simply not requested, and so read as absent.
 *
 * @internal
 */
function isRequestableOnBinance(name: string): boolean {
  return name.trim().length > 0 && !name.includes("::");
}

/**
 * Map one `premiumIndex` row onto the normalized tick.
 *
 * `name` is set by the caller, not from `row.symbol`, so a matched tick carries
 * the caller's exact spelling and `ticks.find(t => t.name === yourName)` always
 * hits regardless of the provider's canonical casing.
 *
 * @internal
 */
export function toBinanceMarkPriceTick(row: RawBinancePremiumIndexRow, name: string): BinanceMarkPriceTick {
  return {
    provider: "binance",
    name,
    markPrice: row.markPrice,
    indexPrice: row.indexPrice,
    binanceLastFundingRate: row.lastFundingRate,
    binanceNextFundingTime: row.nextFundingTime,
    ...(row.time !== undefined ? { time: row.time } : {}),
  };
}

/**
 * Fetch and normalize Binance mark prices — the provider's whole fetch story for
 * this endpoint.
 *
 * The request form adapts to the input, because `premiumIndex` has no
 * batch-by-name form:
 * - **exactly one requestable name** → `?symbol=NAME`, measured weight **1**;
 * - **many or no names** → the all-symbols form (weight **10**), filtered
 *   client-side.
 *
 * Names the provider does not carry are absent from the result rather than an
 * error, so one unlisted market never fails a batch read.
 *
 * @internal
 */
export async function fetchBinanceMarkPrices(
  baseURL: string,
  names?: readonly string[],
): Promise<BinanceMarkPriceTick[]> {
  const requested = names?.filter(isRequestableOnBinance);

  if (requested && requested.length === 1) {
    const name = requested[0]!;
    const row = await fetchBinancePremiumIndexOne(baseURL, toBinanceSymbol(name));
    return row ? [toBinanceMarkPriceTick(row, name)] : [];
  }

  const rows = await fetchBinancePremiumIndexAll(baseURL);
  if (!requested) return rows.map((row) => toBinanceMarkPriceTick(row, row.symbol));

  // Index by upper-cased symbol so the caller's spelling can be handed back.
  const bySymbol = new Map(rows.map((row) => [toBinanceSymbol(row.symbol), row]));
  const ticks: BinanceMarkPriceTick[] = [];
  for (const name of requested) {
    const row = bySymbol.get(toBinanceSymbol(name));
    if (row) ticks.push(toBinanceMarkPriceTick(row, name));
  }
  return ticks;
}
