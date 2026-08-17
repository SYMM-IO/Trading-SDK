import axios, { isAxiosError } from "axios";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { Orderbook } from "../../types";
import { BINANCE_DEPTH_PATH, type BinanceOrderbookMarket } from "./constants";
import { parseBinanceDepthLevels, type RawBinanceDepthSnapshot } from "./parse-depth";

/**
 * Parameters for {@link fetchBinanceDepth}.
 */
export interface FetchBinanceDepthParameters {
  /** REST host, without a trailing slash. */
  restUrl: string;
  /** Which Binance market to read. */
  market: BinanceOrderbookMarket;
  /** Binance symbol, upper-case (e.g. `"BTCUSDT"`). */
  symbol: string;
  /** Market name as SYMMIO names it, carried onto the returned book. */
  marketName: string;
  /** Levels per side. Must already be validated against the market's allowed depths. */
  limit: number;
  /** Aborts the request. */
  signal?: AbortSignal;
}

/**
 * Fetch a depth snapshot and normalize it into an {@link Orderbook}.
 *
 * Binance returns bids descending and asks ascending, which is the SDK's own
 * ordering, so no re-sorting is needed. Zero-size levels never appear in a
 * snapshot (only in the diff stream, where a zero means removal) but are
 * filtered defensively so a snapshot can never seed a phantom level.
 *
 * @param parameters - Endpoint, symbol, and depth.
 * @returns The snapshot, synchronized to `lastUpdateId`.
 * @throws {SymmApiError} when the request fails with an HTTP response.
 * @throws {SymmError} when the response is not a depth snapshot.
 *
 * @example
 * ```ts
 * const book = await fetchBinanceDepth({
 *   restUrl: "https://fapi.binance.com",
 *   market: "usd-m-futures",
 *   symbol: "BTCUSDT",
 *   marketName: "BTCUSDT",
 *   limit: 100,
 * });
 * ```
 */
export async function fetchBinanceDepth(parameters: FetchBinanceDepthParameters): Promise<Orderbook> {
  const { restUrl, market, symbol, marketName, limit, signal } = parameters;
  const url = `${restUrl}${BINANCE_DEPTH_PATH[market]}`;

  try {
    const response = await axios.get<RawBinanceDepthSnapshot>(url, {
      params: { symbol, limit },
      signal,
    });

    const snapshot = response.data;

    if (!snapshot || typeof snapshot.lastUpdateId !== "number" || !Array.isArray(snapshot.bids)) {
      throw new SymmError(
        "api",
        "FETCH_BINANCE_DEPTH_FAILED",
        `Binance depth response was not a snapshot for ${symbol}.`,
      );
    }

    return {
      marketName,
      bids: parseBinanceDepthLevels(snapshot.bids).filter((level) => level.size > 0),
      asks: parseBinanceDepthLevels(snapshot.asks).filter((level) => level.size > 0),
      lastUpdateId: snapshot.lastUpdateId,
      /** Spot omits both timestamps; `0` means "the venue did not say". */
      timestamp: snapshot.T ?? snapshot.E ?? 0,
    };
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_BINANCE_DEPTH_FAILED", baseURL: restUrl });
    }

    throw new SymmError(
      "api",
      "FETCH_BINANCE_DEPTH_FAILED",
      `Failed to fetch Binance depth for ${symbol}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
