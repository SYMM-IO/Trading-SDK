import axios, { isAxiosError } from "axios";
import type { RawBinanceExchangeInfo, RawBinancePremiumIndexRow } from "./types";

/**
 * Path of the mark/index/funding endpoint, appended to the configured
 * `priceService.url` host root.
 *
 * @internal
 */
const PREMIUM_INDEX_PATH = "/fapi/v1/premiumIndex";

/** Path of the liveness probe. @internal */
const PING_PATH = "/fapi/v1/ping";

/** Path of the exchange metadata listing. @internal */
const EXCHANGE_INFO_PATH = "/fapi/v1/exchangeInfo";

/**
 * Normalize `?symbol=` (single object) and all-symbols (array) responses to one
 * array, so callers have a single shape to map.
 */
function toRows(data: RawBinancePremiumIndexRow | RawBinancePremiumIndexRow[]): RawBinancePremiumIndexRow[] {
  return Array.isArray(data) ? data : [data];
}

/**
 * Fetch `premiumIndex` for **every** listed symbol.
 *
 * Measured request weight: **10**. Prefer {@link fetchBinancePremiumIndexOne}
 * when a single symbol is needed — that form costs weight 1.
 *
 * @internal
 */
export async function fetchBinancePremiumIndexAll(baseURL: string): Promise<RawBinancePremiumIndexRow[]> {
  const response = await axios.get<RawBinancePremiumIndexRow[]>(PREMIUM_INDEX_PATH, { baseURL });
  return toRows(response.data);
}

/**
 * Fetch `premiumIndex` for a single symbol — measured request weight **1**.
 *
 * An unknown symbol makes Binance reply `400`; that is reported as an absent
 * price (`null`) rather than a transport failure, so an unlisted market reads
 * the same as one the provider simply does not carry. Any other status
 * propagates.
 *
 * @internal
 */
export async function fetchBinancePremiumIndexOne(
  baseURL: string,
  symbol: string,
): Promise<RawBinancePremiumIndexRow | null> {
  try {
    const response = await axios.get<RawBinancePremiumIndexRow | RawBinancePremiumIndexRow[]>(PREMIUM_INDEX_PATH, {
      baseURL,
      params: { symbol },
    });
    return toRows(response.data)[0] ?? null;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 400) return null;
    throw err;
  }
}

/**
 * Probe Binance liveness (`GET /fapi/v1/ping`). Resolves `true` on success.
 *
 * @internal
 */
export async function fetchBinancePing(baseURL: string): Promise<true> {
  await axios.get(PING_PATH, { baseURL });
  return true;
}

/**
 * Fetch Binance exchange metadata (`GET /fapi/v1/exchangeInfo`).
 *
 * Cheap on request weight (1) but a **~1 MB** payload, so callers must cache it
 * aggressively and never poll it.
 *
 * @internal
 */
export async function fetchBinanceExchangeInfo(baseURL: string): Promise<RawBinanceExchangeInfo> {
  const response = await axios.get<RawBinanceExchangeInfo>(EXCHANGE_INFO_PATH, { baseURL });
  return response.data;
}
