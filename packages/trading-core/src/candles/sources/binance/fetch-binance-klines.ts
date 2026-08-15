import axios, { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { Candle } from "../../types";
import { BINANCE_KLINES_PATH, type BinanceMarket } from "./constants";
import { parseBinanceKline, type RawBinanceKline } from "./parse-kline";

/**
 * Parameters for {@link fetchBinanceKlines}.
 */
export interface FetchBinanceKlinesParameters {
  /** REST host, without a trailing slash. */
  restUrl: string;
  /** Which Binance market to read. */
  market: BinanceMarket;
  /** Binance symbol, upper-case (e.g. `"BTCUSDT"`). */
  symbol: string;
  /** Binance interval string (e.g. `"1m"`). */
  interval: string;
  /** Earliest bar open time to return, unix ms, inclusive. */
  startTime?: number;
  /** Latest bar open time to return, unix ms, inclusive on Binance's side. */
  endTime?: number;
  /** Bars to request. Must already be capped to the market's maximum. */
  limit: number;
  /** Aborts the request. */
  signal?: AbortSignal;
}

/**
 * Issue one Binance klines request and normalize the response.
 *
 * A single request only — {@link createBinanceCandleSource} layers paging on
 * top. Bars come back in ascending time order and that order is preserved.
 *
 * @param parameters - Endpoint, symbol, interval, and range.
 * @returns The bars Binance returned, ascending by time.
 * @throws {SymmApiError} when the request fails with an HTTP response.
 * @throws {SymmError} when the response is not an array of klines.
 */
export async function fetchBinanceKlines(parameters: FetchBinanceKlinesParameters): Promise<Candle[]> {
  const { restUrl, market, symbol, interval, startTime, endTime, limit, signal } = parameters;
  const url = `${restUrl}${BINANCE_KLINES_PATH[market]}`;

  try {
    const response = await axios.get<RawBinanceKline[]>(url, {
      params: { symbol, interval, startTime, endTime, limit },
      signal,
    });

    if (!Array.isArray(response.data)) {
      throw new SymmError(
        "api",
        "FETCH_BINANCE_KLINES_FAILED",
        `Binance klines response was not an array for ${symbol} ${interval}.`,
      );
    }

    return response.data.map(parseBinanceKline);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_BINANCE_KLINES_FAILED", baseURL: restUrl });
    }

    throw new SymmError(
      "api",
      "FETCH_BINANCE_KLINES_FAILED",
      `Failed to fetch Binance klines for ${symbol} ${interval}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
