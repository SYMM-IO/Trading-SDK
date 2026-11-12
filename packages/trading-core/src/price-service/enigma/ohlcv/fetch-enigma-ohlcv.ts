import { isAxiosError, isCancel } from "axios";
import type { Candle } from "../../../candles/types";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { getSymbolOhlcvApiV1PricesSymbolAddressOhlcvGet, PriceTimeframe } from "./generated/enigma-price-service-ohlcv";
import { parseEnigmaOhlcvPage, type EnigmaOhlcvPage } from "./parse-enigma-ohlcv";

/** Parameters for a single bounded request, in the service's inclusive date units. @internal */
export interface FetchEnigmaOhlcvParameters {
  /** Configured price-service URL. No proxy or API key is needed. */
  baseURL: string;
  /** Address resolved from the complete market name, preserving address case. */
  symbolAddress: string;
  /** A timeframe declared by the service. */
  timeframe: PriceTimeframe;
  /** Inclusive start: integer Unix seconds or an ISO-8601 datetime with a timezone. */
  fromDate: number | string;
  /** Inclusive end: integer Unix seconds or an ISO-8601 datetime with a timezone. */
  toDate: number | string;
  /** Optional vendor limit. Sources omit it and bound their date windows instead. */
  limit?: number;
  /** Include flat candles. Defaults to false; only booleans are accepted. */
  includeFlat?: boolean;
  /** Aborts the request. */
  signal?: AbortSignal;
}

function dateToMs(value: number | string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && Number.isSafeInteger(value * 1000)) {
    return value * 1000;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  throw new SymmError(
    "validation",
    "INVALID_ENIGMA_OHLCV_RANGE",
    "OHLCV dates must be integer Unix seconds or ISO-8601 datetimes with a timezone.",
  );
}

/**
 * Fetch one final-price OHLCV window directly from the public price service.
 *
 * This transport uses the service's inclusive dates, not CandleSource's
 * millisecond [from, to) range. Pagination and boundary discovery belong to
 * the source. No history cache, polling, or exhaustion inference is applied.
 *
 * @param parameters - Endpoint, symbol address, timeframe, and bounded window.
 * @returns Candles with millisecond start times and unchanged USD quote volume.
 * @throws {SymmError} when inputs or the response are invalid.
 * @throws {SymmApiError} when the request fails; cancellation passes through.
 * @internal
 */
export async function fetchEnigmaOhlcv(parameters: FetchEnigmaOhlcvParameters): Promise<Candle[]> {
  return (await fetchEnigmaOhlcvPage(parameters)).candles;
}

/** Fetch a public OHLCV window, preserving optional backend pagination metadata. @internal */
export async function fetchEnigmaOhlcvPage(parameters: FetchEnigmaOhlcvParameters): Promise<EnigmaOhlcvPage> {
  const { baseURL, symbolAddress, timeframe, fromDate, toDate, limit, signal } = parameters;
  const includeFlat = parameters.includeFlat === undefined ? false : parameters.includeFlat;

  if (typeof includeFlat !== "boolean") {
    throw new SymmError("validation", "INVALID_ENIGMA_OHLCV_FLAT_ENABLE", "includeFlat must be true or false.");
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 200)) {
    throw new SymmError("validation", "INVALID_ENIGMA_OHLCV_LIMIT", "OHLCV limit must be an integer from 1 to 200.");
  }
  if (!Object.values(PriceTimeframe).includes(timeframe)) {
    throw new SymmError("validation", "UNSUPPORTED_CANDLE_RESOLUTION", `Unsupported OHLCV timeframe: ${timeframe}.`);
  }
  if (typeof symbolAddress !== "string" || symbolAddress.trim().length === 0) {
    throw new SymmError("validation", "UNMAPPED_CANDLE_MARKET", "OHLCV requires a symbol address.");
  }
  if (dateToMs(fromDate) > dateToMs(toDate)) {
    throw new SymmError("validation", "INVALID_ENIGMA_OHLCV_RANGE", "OHLCV fromDate must not be after toDate.");
  }

  try {
    const response = await getSymbolOhlcvApiV1PricesSymbolAddressOhlcvGet(
      encodeURIComponent(symbolAddress),
      {
        timeframe,
        from_date: fromDate,
        to_date: toDate,
        ...(limit === undefined ? {} : { limit }),
        flat_enable: includeFlat,
      },
      { baseURL, signal, timeout: 30_000 },
    );
    return parseEnigmaOhlcvPage(response.data);
  } catch (err) {
    if (err instanceof SymmError || isCancel(err)) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ENIGMA_OHLCV_FAILED", baseURL });
    }
    throw new SymmError(
      "api",
      "FETCH_ENIGMA_OHLCV_FAILED",
      `Failed to fetch price-service OHLCV: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
