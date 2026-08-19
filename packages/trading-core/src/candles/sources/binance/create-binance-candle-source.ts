import { SymmError } from "../../../shared/errors/symm-error";
import type { WebSocketConstructor } from "../../../shared/types/websocket";
import type { Unwatch } from "../../../websocket/notifications/watch-notifications";
import type {
  Candle,
  CandleResolution,
  CandleSource,
  CandleSymbol,
  GetCandlesParameters,
  GetCandlesReturnType,
  WatchCandlesParameters,
} from "../../types";
import {
  BINANCE_MAX_LIMIT,
  BINANCE_MAX_PAGES,
  BINANCE_REST_URL,
  BINANCE_WS_URL,
  type BinanceMarket,
} from "./constants";
import { fetchBinanceExchangeInfo, type BinanceSymbolInfo } from "./fetch-binance-exchange-info";
import { fetchBinanceKlines } from "./fetch-binance-klines";
import { getBinanceSupportedResolutions, toBinanceInterval } from "./map-resolution";
import { watchBinanceKlines } from "./watch-binance-klines";

/**
 * Parameters for {@link createBinanceCandleSource}.
 */
export interface BinanceCandleSourceParameters {
  /**
   * Which Binance market to read. Defaults to `"usd-m-futures"` — its symbols
   * are perpetual contracts, matching what a SYMMIO market actually is.
   */
  market?: BinanceMarket;
  /** Override the REST host (a regional mirror, or your own caching proxy). */
  restUrl?: string;
  /** Override the WebSocket endpoint. */
  wsUrl?: string;
  /**
   * Map a SYMMIO market name onto a Binance symbol, or return `undefined` when
   * the market has no Binance listing.
   *
   * Defaults to an upper-case identity mapping, which holds for current SYMMIO
   * deployments where market names are already Binance USD-M symbols. Override
   * it rather than relying on that coincidence if your deployment's names can
   * diverge — an unmapped name otherwise resolves to a symbol that does not
   * exist and the chart simply stays empty.
   */
  resolveSymbol?: (marketName: string) => string | undefined;
  /**
   * WebSocket implementation for {@link CandleSource.watchCandles}. Defaults to
   * `globalThis.WebSocket`; pass the `ws` package in Node environments without one.
   */
  webSocketConstructor?: WebSocketConstructor;
}

function defaultResolveSymbol(marketName: string): string {
  return marketName.toUpperCase();
}

function resolveWebSocketConstructor(injected?: WebSocketConstructor): WebSocketConstructor {
  const ctor = injected ?? (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
  if (!ctor) {
    throw new SymmError(
      "config",
      "NO_WEBSOCKET_IMPLEMENTATION",
      "No WebSocket implementation available. Pass `webSocketConstructor` to createBinanceCandleSource (e.g. the `ws` package in Node).",
    );
  }
  return ctor;
}

/**
 * Create a {@link CandleSource} backed by Binance klines.
 *
 * History comes from the REST `/klines` endpoint, paged backwards from the end
 * of the requested range, and live bars from the kline WebSocket stream. Both
 * are reachable directly from a browser — Binance serves permissive CORS
 * headers on market data, so no proxy or API key is involved.
 *
 * Two caveats worth surfacing to users of a chart built on this:
 * - The series is `priceBasis: "reference-exchange"`. It is Binance's perp
 *   price, not the SYMMIO solver's mark price that a trade actually settles at.
 * - `api.binance.com` and `fapi.binance.com` are blocked in some jurisdictions.
 *   Supply `restUrl`/`wsUrl` to route through your own proxy where that matters.
 *
 * @param parameters - Market selection, endpoint overrides, and symbol mapping.
 * @returns A source usable by `getCandlesQueryOptions`, `useCandles`, or
 *   `toTradingViewDatafeed`.
 *
 * @example
 * ```ts
 * const source = createBinanceCandleSource();
 * const { candles } = await source.getCandles({
 *   marketName: "BTCUSDT",
 *   resolution: "1m",
 *   from: Date.now() - 60 * 60 * 1000,
 *   to: Date.now(),
 *   limit: 60,
 * });
 * ```
 */
export function createBinanceCandleSource(parameters: BinanceCandleSourceParameters = {}): CandleSource {
  const market = parameters.market ?? "usd-m-futures";
  const restUrl = parameters.restUrl ?? BINANCE_REST_URL[market];
  const wsUrl = parameters.wsUrl ?? BINANCE_WS_URL[market];
  const resolveSymbol = parameters.resolveSymbol ?? defaultResolveSymbol;
  const maxLimit = BINANCE_MAX_LIMIT[market];

  /**
   * `exchangeInfo` lists every contract on the venue and only changes on a
   * listing or delisting, so it is fetched once per source and shared by every
   * `getSymbol` call. The promise itself is cached so concurrent callers during
   * the first load share one request; a rejection clears it so a transient
   * failure does not poison the source for its lifetime.
   */
  let exchangeInfo: Promise<Map<string, BinanceSymbolInfo>> | null = null;

  function getExchangeInfo(): Promise<Map<string, BinanceSymbolInfo>> {
    if (!exchangeInfo) {
      exchangeInfo = fetchBinanceExchangeInfo(restUrl, market).catch((err: unknown) => {
        exchangeInfo = null;
        throw err;
      });
    }
    return exchangeInfo;
  }

  function requireInterval(resolution: CandleResolution): string {
    const interval = toBinanceInterval(market, resolution);
    if (!interval) {
      throw new SymmError(
        "validation",
        "UNSUPPORTED_CANDLE_RESOLUTION",
        `Binance ${market} has no klines interval for resolution "${resolution}".`,
      );
    }
    return interval;
  }

  function requireSourceSymbol(marketName: string): string {
    const symbol = resolveSymbol(marketName);
    if (!symbol) {
      throw new SymmError(
        "validation",
        "UNMAPPED_CANDLE_MARKET",
        `No Binance symbol is mapped for market "${marketName}".`,
      );
    }
    return symbol;
  }

  return {
    id: `binance:${market}`,
    priceBasis: "reference-exchange",
    supportedResolutions: getBinanceSupportedResolutions(market),
    maxCandlesPerRequest: maxLimit,

    async getSymbol(marketName: string): Promise<CandleSymbol | undefined> {
      const sourceSymbol = resolveSymbol(marketName);
      if (!sourceSymbol) return undefined;

      const info = (await getExchangeInfo()).get(sourceSymbol.toUpperCase());
      if (!info) return undefined;

      const description = info.baseAsset && info.quoteAsset ? `${info.baseAsset} / ${info.quoteAsset}` : info.symbol;

      return {
        marketName,
        sourceSymbol: info.symbol,
        description,
        pricePrecision: info.pricePrecision,
        /** Binance reports base-asset volume; two decimals reads well for every listed contract. */
        volumePrecision: 2,
      };
    },

    async getCandles(getCandlesParameters: GetCandlesParameters): Promise<GetCandlesReturnType> {
      const { marketName, resolution, from, to, limit, signal } = getCandlesParameters;
      const interval = requireInterval(resolution);
      const symbol = requireSourceSymbol(marketName);
      const wanted = limit && limit > 0 ? limit : Number.POSITIVE_INFINITY;

      const candles: Candle[] = [];

      /**
       * Paged backwards from `to`, not forwards from `from`. Binance caps a
       * range request from its *start*: sending `startTime`, `endTime` and
       * `limit` together returns the OLDEST `limit` bars in the window, which
       * for a chart is the wrong end entirely. Sending `endTime` alone returns
       * the newest bars ending there, which is what a chart scrolling back
       * actually needs; the `from` bound is then applied client-side.
       */
      let cursorEnd = to - 1;

      for (let page = 0; page < BINANCE_MAX_PAGES; page++) {
        if (cursorEnd < from) break;

        const remaining = wanted - candles.length;
        const requestLimit = Math.max(1, Math.min(maxLimit, remaining));

        const batch = await fetchBinanceKlines({
          restUrl,
          market,
          symbol,
          interval,
          endTime: cursorEnd,
          limit: requestLimit,
          signal,
        });
        const oldest = batch[0];
        if (!oldest) break;

        candles.unshift(...batch.filter((candle) => candle.time >= from && candle.time < to));

        /** Reached the requested start, or the venue has nothing older. */
        if (oldest.time <= from || batch.length < requestLimit) break;
        if (candles.length >= wanted) break;

        const nextCursor = oldest.time - 1;
        /** No-progress guard: without it a venue quirk could spin the loop. */
        if (nextCursor >= cursorEnd) break;
        cursorEnd = nextCursor;
      }

      return {
        candles,
        /**
         * An empty result is the venue saying it has nothing in this window —
         * for a 24/7 market that means the range predates the listing, so a
         * chart paging backwards should stop rather than keep asking.
         */
        noMoreData: candles.length === 0,
      };
    },

    watchCandles(watchCandlesParameters: WatchCandlesParameters): Unwatch {
      const { marketName, resolution, onCandle, onReset, onStatusChange, onError } = watchCandlesParameters;

      return watchBinanceKlines({
        wsUrl,
        symbol: requireSourceSymbol(marketName),
        interval: requireInterval(resolution),
        webSocketConstructor: resolveWebSocketConstructor(parameters.webSocketConstructor),
        onCandle,
        onReset,
        onStatusChange,
        onError,
      });
    },
  };
}
