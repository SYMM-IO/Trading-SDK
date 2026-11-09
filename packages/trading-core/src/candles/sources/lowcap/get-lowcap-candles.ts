import { fetchEnigmaOhlcvPage } from "../../../price-service/enigma/ohlcv/fetch-enigma-ohlcv";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Candle, GetCandlesParameters, GetCandlesReturnType } from "../../types";
import { ceilLowcapCandleTime, shiftLowcapCandleTime } from "./lowcap-candle-time";
import { toLowcapTimeframe } from "./map-resolution";

/** Endpoint and resolved identity for one history read. @internal */
export interface LowcapHistoryParameters extends GetCandlesParameters {
  baseURL: string;
  symbolAddress: string;
  includeFlat: boolean;
}

/** Match the backend's flat filter after joining independently filtered pages. */
function filterFlatCandles(candles: Candle[]): Candle[] {
  return candles.filter((candle, index) => {
    const previous = candles[index - 1];
    return (
      !previous ||
      candle.volume !== 0 ||
      [candle.open, candle.high, candle.low, candle.close].some((price) => price !== previous.close)
    );
  });
}

/** Read bounded UTC windows backwards without interpreting sparse pages as exhaustion. @internal */
export async function getLowcapCandles(parameters: LowcapHistoryParameters): Promise<GetCandlesReturnType> {
  const { baseURL, symbolAddress, resolution, from, to, limit, includeFlat, signal } = parameters;
  const timeframe = toLowcapTimeframe(resolution);
  if (!timeframe) {
    throw new SymmError("validation", "UNSUPPORTED_CANDLE_RESOLUTION", `Unsupported lowcap resolution: ${resolution}.`);
  }
  if (
    ![from, to].every((time) => Number.isSafeInteger(time) && Number.isFinite(new Date(time).getTime())) ||
    from >= to
  ) {
    throw new SymmError(
      "validation",
      "INVALID_CANDLE_RANGE",
      "Candle ranges must be finite integer milliseconds with from < to.",
    );
  }
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new SymmError("validation", "INVALID_CANDLE_LIMIT", "Candle limit must be a positive integer.");
  }

  const start = ceilLowcapCandleTime(from, resolution);
  let end = ceilLowcapCandleTime(to, resolution);
  const pages: Candle[][] = [];
  let count = 0;
  let hasOlder: boolean | undefined;

  while (end > start) {
    signal?.throwIfAborted();
    // Inclusive to_date can return the next bucket as well. Reserve one of
    // the 200 intervals for that boundary bar, then discard it below. This
    // preserves the whole preceding bucket, including subsecond samples.
    const pageStart = Math.max(start, shiftLowcapCandleTime(end, resolution, -199));
    const page = await fetchEnigmaOhlcvPage({
      baseURL,
      symbolAddress,
      timeframe,
      fromDate: new Date(pageStart).toISOString(),
      toDate: new Date(end).toISOString(),
      includeFlat,
      signal,
    });
    signal?.throwIfAborted();
    const candles = page.candles.filter((candle) => candle.time >= pageStart && candle.time < end && candle.time < to);
    pages.push(candles);
    count += candles.length;
    hasOlder = page.hasOlder;
    end = pageStart;
    if (hasOlder === false) break;
    if (limit !== undefined) {
      /** The first flat candle is provisional until an older page supplies its preceding price. */
      const enough = includeFlat ? count >= limit : filterFlatCandles([...pages].reverse().flat()).length > limit;
      if (enough) break;
    }
  }

  const all = pages.reverse().flat();
  const filtered = includeFlat ? all : filterFlatCandles(all);
  const candles = limit === undefined ? filtered : filtered.slice(-limit);
  return { candles, noMoreData: hasOlder === false && candles.length === filtered.length };
}
