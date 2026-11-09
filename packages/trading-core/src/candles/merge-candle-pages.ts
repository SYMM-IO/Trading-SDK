import type { CandleHistoryPage } from "./history-query";
import type { Candle, GetCandlesReturnType } from "./types";

/** Merge source responses without inventing candles or inferring exhaustion from their lengths. @internal */
export function mergeCandlePages(pages: readonly CandleHistoryPage[]): GetCandlesReturnType {
  const candles = new Map<number, Candle>();
  for (const page of [...pages].reverse()) {
    for (const candle of page.candles) {
      if (candle.time >= page.from && candle.time < page.to) candles.set(candle.time, candle);
    }
  }
  return {
    candles: [...candles.values()].sort((a, b) => a.time - b.time),
    noMoreData: pages.at(-1)?.noMoreData ?? false,
  };
}
