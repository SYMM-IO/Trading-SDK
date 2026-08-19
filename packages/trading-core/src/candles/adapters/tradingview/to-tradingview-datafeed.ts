import type { Unwatch } from "../../../websocket/notifications/watch-notifications";
import { resolutionToMs } from "../../resolution";
import type { CandleSource } from "../../types";
import { fromTradingViewResolution, toTradingViewResolution } from "./map-resolution";
import type { TradingViewBar, TradingViewDatafeed } from "./types";

/**
 * Options for {@link toTradingViewDatafeed}.
 */
export interface ToTradingViewDatafeedOptions {
  /**
   * Exchange label shown in the chart's symbol header. Defaults to the source's
   * {@link CandleSource.id}.
   */
  exchange?: string;
  /**
   * Session string for the instrument. Defaults to `"24x7"` — correct for
   * crypto perps, which never close.
   */
  session?: string;
  /**
   * Timezone the chart renders bar times in. Defaults to `"Etc/UTC"`, matching
   * the UTC-aligned bar boundaries every source returns.
   */
  timezone?: string;
}

/** Strips an exchange prefix, so `"BINANCE:BTCUSDT"` resolves as `"BTCUSDT"`. */
function toMarketName(symbolName: string): string {
  const separatorIndex = symbolName.indexOf(":");
  return separatorIndex === -1 ? symbolName : symbolName.slice(separatorIndex + 1);
}

function toTradingViewBar(candle: {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): TradingViewBar {
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

/**
 * Adapt a {@link CandleSource} into a TradingView Charting Library datafeed.
 *
 * A pure translation layer: resolution codes, unix-second period params, and
 * the library's callback style on one side; the SDK's resolution vocabulary,
 * millisecond timestamps, and promise/`Unwatch` style on the other. It holds no
 * framework state and imports nothing from TradingView — the datafeed contract
 * is modeled structurally, so the returned object satisfies the library's own
 * `IBasicDataFeed` type without the SDK depending on the licensed package.
 *
 * Symbol search is reported as unsupported. A SYMMIO app already has its market
 * list (`useMarkets`), and driving symbol selection from that is both more
 * accurate and less surprising than a second search surface here.
 *
 * @param source - The candle source to read from.
 * @param options - Presentation overrides for the symbol header.
 * @returns A datafeed object to pass to `widget({ datafeed })`.
 *
 * @example
 * ```ts
 * const datafeed = toTradingViewDatafeed(createBinanceCandleSource());
 * new TradingView.widget({ datafeed, symbol: "BTCUSDT", interval: "60" });
 * ```
 */
export function toTradingViewDatafeed(
  source: CandleSource,
  options: ToTradingViewDatafeedOptions = {},
): TradingViewDatafeed {
  const exchange = options.exchange ?? source.id;
  const session = options.session ?? "24x7";
  const timezone = options.timezone ?? "Etc/UTC";

  const supportedResolutions = source.supportedResolutions.map(toTradingViewResolution);
  const secondsMultipliers = source.supportedResolutions
    .filter((resolution) => resolution === "1s" || resolution === "10s")
    .map((resolution) => (resolution === "1s" ? "1" : "10"));

  /** Live subscriptions keyed by the library's listener guid. */
  const subscriptions = new Map<string, Unwatch>();

  return {
    onReady(callback) {
      /**
       * The library requires `onReady` to resolve asynchronously; calling the
       * callback synchronously puts it into an inconsistent startup state.
       */
      setTimeout(() => {
        callback({
          supported_resolutions: supportedResolutions,
          exchanges: [{ value: exchange, name: exchange, desc: exchange }],
          symbols_types: [{ name: "crypto", value: "crypto" }],
          supports_search: false,
          supports_group_request: false,
        });
      }, 0);
    },

    searchSymbols(_userInput, _exchange, _symbolType, onResult) {
      onResult([]);
    },

    resolveSymbol(symbolName, onResolve, onError) {
      const marketName = toMarketName(symbolName);

      source
        .getSymbol(marketName)
        .then((symbol) => {
          if (!symbol) {
            onError(`Unknown symbol: ${symbolName}`);
            return;
          }

          onResolve({
            ticker: symbol.marketName,
            name: symbol.marketName,
            full_name: symbol.marketName,
            description: symbol.description,
            type: "crypto",
            session,
            timezone,
            exchange,
            listed_exchange: exchange,
            format: "price",
            /** The library divides integer prices by this to place the decimal point. */
            pricescale: 10 ** symbol.pricePrecision,
            minmov: 1,
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            has_seconds: secondsMultipliers.length > 0,
            /**
             * `false` so the chart leaves real gaps rather than inventing flat
             * bars where the venue reported none.
             */
            has_empty_bars: false,
            supported_resolutions: supportedResolutions,
            ...(secondsMultipliers.length > 0 ? { seconds_multipliers: secondsMultipliers } : {}),
            volume_precision: symbol.volumePrecision,
            data_status: source.watchCandles ? "streaming" : "endofday",
          });
        })
        .catch((err: unknown) => {
          onError(err instanceof Error ? err.message : String(err));
        });
    },

    getBars(symbolInfo, resolution, periodParams, onResult, onError) {
      const candleResolution = fromTradingViewResolution(resolution);
      if (!candleResolution) {
        onError(`Unsupported resolution: ${resolution}`);
        return;
      }

      const { from, to, countBack } = periodParams;
      const toMs = to * 1000;

      /**
       * `countBack` takes precedence over `from` in the library's contract: it
       * is the exact number of bars the chart needs ending at `to`. Widening
       * the window to at least that many bars keeps a short `from` from
       * starving the chart, while still honoring an explicitly wider request.
       */
      const fromMs = Math.min(from * 1000, toMs - countBack * resolutionToMs(candleResolution));

      source
        .getCandles({
          marketName: symbolInfo.name,
          resolution: candleResolution,
          from: fromMs,
          to: toMs,
          limit: countBack,
        })
        .then((result) => {
          onResult(result.candles.map(toTradingViewBar), { noData: result.noMoreData });
        })
        .catch((err: unknown) => {
          onError(err instanceof Error ? err.message : String(err));
        });
    },

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeeded) {
      const candleResolution = fromTradingViewResolution(resolution);
      if (!candleResolution || !source.watchCandles) return;

      /** Guard against the library re-subscribing a guid it never released. */
      subscriptions.get(listenerGuid)?.();

      const unwatch = source.watchCandles({
        marketName: symbolInfo.name,
        resolution: candleResolution,
        onCandle: (candle) => onTick(toTradingViewBar(candle)),
        /**
         * A reconnect means bars were missed. Telling the library to drop its
         * cache makes it refetch history instead of splicing the live bar onto
         * a series with a hole in it.
         */
        onReset: onResetCacheNeeded,
      });

      subscriptions.set(listenerGuid, unwatch);
    },

    unsubscribeBars(listenerGuid) {
      subscriptions.get(listenerGuid)?.();
      subscriptions.delete(listenerGuid);
    },
  };
}
