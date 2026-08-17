import axios, { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { countTickDecimals } from "../../tick-size";
import { BINANCE_ORDERBOOK_EXCHANGE_INFO_PATH, type BinanceOrderbookMarket } from "./constants";

/**
 * The subset of a Binance `exchangeInfo` symbol entry an order book reads.
 */
interface RawBinanceExchangeInfoSymbol {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  /** Present on USD-M futures; absent on spot, where precision comes from the filters. */
  pricePrecision?: number;
  /** Present on USD-M futures; absent on spot. */
  quantityPrecision?: number;
  filters?: { filterType?: string; tickSize?: string; stepSize?: string }[];
}

/**
 * Trading increments and precisions for one Binance symbol.
 *
 * `tickSize` and `stepSize` are what the venue actually enforces; the two
 * precisions are derived from them so a UI's decimal count can never disagree
 * with the grid the venue quotes on.
 */
export interface BinanceSymbolFilters {
  /** Binance symbol, upper-case. */
  symbol: string;
  /** Base asset (e.g. `"BTC"`). */
  baseAsset: string;
  /** Quote asset (e.g. `"USDT"`). */
  quoteAsset: string;
  /** Smallest price increment the venue allows. */
  tickSize: number;
  /** Smallest quantity increment the venue allows. */
  stepSize: number;
  /** Decimal places implied by {@link BinanceSymbolFilters.tickSize}. */
  pricePrecision: number;
  /** Decimal places implied by {@link BinanceSymbolFilters.stepSize}. */
  sizePrecision: number;
}

function toIncrement(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toSymbolFilters(entry: RawBinanceExchangeInfoSymbol): BinanceSymbolFilters {
  const priceFilter = entry.filters?.find((filter) => filter.filterType === "PRICE_FILTER");
  const lotSize = entry.filters?.find((filter) => filter.filterType === "LOT_SIZE");

  /**
   * The filters are authoritative — they are the increments an order is
   * rejected for violating. The futures-only `pricePrecision`/`quantityPrecision`
   * fields are a fallback, and a final default covers a venue that reports
   * neither.
   */
  const tickSize = toIncrement(priceFilter?.tickSize, 10 ** -(entry.pricePrecision ?? 2));
  const stepSize = toIncrement(lotSize?.stepSize, 10 ** -(entry.quantityPrecision ?? 3));

  return {
    symbol: entry.symbol,
    baseAsset: entry.baseAsset ?? "",
    quoteAsset: entry.quoteAsset ?? "",
    tickSize,
    stepSize,
    pricePrecision: countTickDecimals(tickSize),
    sizePrecision: countTickDecimals(stepSize),
  };
}

/**
 * Fetch Binance `exchangeInfo` and index each symbol's increments by symbol.
 *
 * Called once per source instance and cached — the response lists every
 * contract on the venue and only changes on a listing or delisting.
 *
 * @param restUrl - REST host, without a trailing slash.
 * @param market - Which Binance market to describe.
 * @param signal - Aborts the request.
 * @returns Increments and precisions keyed by upper-case Binance symbol.
 * @throws {SymmApiError} when the request fails with an HTTP response.
 * @throws {SymmError} when the response has no `symbols` array.
 */
export async function fetchBinanceSymbolFilters(
  restUrl: string,
  market: BinanceOrderbookMarket,
  signal?: AbortSignal,
): Promise<Map<string, BinanceSymbolFilters>> {
  const url = `${restUrl}${BINANCE_ORDERBOOK_EXCHANGE_INFO_PATH[market]}`;

  try {
    const response = await axios.get<{ symbols?: RawBinanceExchangeInfoSymbol[] }>(url, { signal });
    const symbols = response.data?.symbols;

    if (!Array.isArray(symbols)) {
      throw new SymmError(
        "api",
        "FETCH_BINANCE_SYMBOL_FILTERS_FAILED",
        "Binance exchangeInfo response had no `symbols` array.",
      );
    }

    return new Map(symbols.map((entry) => [entry.symbol.toUpperCase(), toSymbolFilters(entry)]));
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_BINANCE_SYMBOL_FILTERS_FAILED", baseURL: restUrl });
    }

    throw new SymmError(
      "api",
      "FETCH_BINANCE_SYMBOL_FILTERS_FAILED",
      `Failed to fetch Binance exchangeInfo: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
