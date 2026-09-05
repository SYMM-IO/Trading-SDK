import axios, { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { BINANCE_EXCHANGE_INFO_PATH, type BinanceMarket } from "./constants";

/**
 * The subset of a Binance `exchangeInfo` symbol entry the SDK reads.
 */
interface RawBinanceExchangeInfoSymbol {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  /** Present on USD-M futures; absent on spot, where precision comes from the price filter. */
  pricePrecision?: number;
  filters?: { filterType?: string; tickSize?: string }[];
}

/**
 * Per-symbol metadata resolved from Binance `exchangeInfo`.
 */
export interface BinanceSymbolInfo {
  /** Binance symbol, upper-case. */
  symbol: string;
  /** Base asset (e.g. `"BTC"`), when the venue reports one. */
  baseAsset?: string;
  /** Quote asset (e.g. `"USDT"`), when the venue reports one. */
  quoteAsset?: string;
  /** Decimal places prices should be rendered at. */
  pricePrecision: number;
}

/**
 * Derive decimal places from a Binance `tickSize` string.
 *
 * `tickSize` is a decimal literal with trailing zeros (`"0.10"`, `"1.00"`), so
 * the count of characters after the dot overstates the real precision; trailing
 * zeros are stripped first.
 *
 * @param tickSize - The `PRICE_FILTER` tick size (e.g. `"0.010"`).
 * @returns Significant decimal places (`"0.010"` → `2`).
 */
export function tickSizeToPrecision(tickSize: string): number {
  const dotIndex = tickSize.indexOf(".");
  if (dotIndex === -1) return 0;
  const fraction = tickSize.slice(dotIndex + 1).replace(/0+$/, "");
  return fraction.length;
}

function toSymbolInfo(entry: RawBinanceExchangeInfoSymbol): BinanceSymbolInfo {
  const priceFilter = entry.filters?.find((filter) => filter.filterType === "PRICE_FILTER");
  const fromTickSize = priceFilter?.tickSize ? tickSizeToPrecision(priceFilter.tickSize) : undefined;

  return {
    symbol: entry.symbol,
    baseAsset: entry.baseAsset,
    quoteAsset: entry.quoteAsset,
    /**
     * The tick size is the authoritative increment a price can move by, so it
     * is preferred; `pricePrecision` is the futures-only fallback and `2` the
     * last resort for a venue that reports neither.
     */
    pricePrecision: fromTickSize ?? entry.pricePrecision ?? 2,
  };
}

/**
 * Fetch Binance `exchangeInfo` and index it by symbol.
 *
 * Called once per source instance and cached — the response is large (every
 * listed contract) and its contents only change when Binance lists or delists.
 *
 * @param restUrl - REST host, without a trailing slash.
 * @param market - Which Binance market to describe.
 * @param signal - Aborts the request.
 * @returns Symbol metadata keyed by upper-case Binance symbol.
 * @throws {SymmApiError} when the request fails with an HTTP response.
 * @throws {SymmError} when the response has no `symbols` array.
 */
export async function fetchBinanceExchangeInfo(
  restUrl: string,
  market: BinanceMarket,
  signal?: AbortSignal,
): Promise<Map<string, BinanceSymbolInfo>> {
  const url = `${restUrl}${BINANCE_EXCHANGE_INFO_PATH[market]}`;

  try {
    const response = await axios.get<{ symbols?: RawBinanceExchangeInfoSymbol[] }>(url, { signal });
    const symbols = response.data?.symbols;

    if (!Array.isArray(symbols)) {
      throw new SymmError(
        "api",
        "FETCH_BINANCE_EXCHANGE_INFO_FAILED",
        "Binance exchangeInfo response had no `symbols` array.",
      );
    }

    return new Map(symbols.map((entry) => [entry.symbol.toUpperCase(), toSymbolInfo(entry)]));
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_BINANCE_EXCHANGE_INFO_FAILED", baseURL: restUrl });
    }

    throw new SymmError(
      "api",
      "FETCH_BINANCE_EXCHANGE_INFO_FAILED",
      `Failed to fetch Binance exchangeInfo: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
