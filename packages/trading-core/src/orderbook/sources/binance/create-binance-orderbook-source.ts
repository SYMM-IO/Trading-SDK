import { SymmError } from "../../../shared/errors/symm-error";
import type { WebSocketConstructor } from "../../../shared/types/websocket";
import type { Unwatch } from "../../../websocket/notifications/watch-notifications";
import type {
  GetOrderbookParameters,
  Orderbook,
  OrderbookSource,
  OrderbookSymbol,
  WatchOrderbookParameters,
} from "../../types";
import {
  BINANCE_DEPTH_DEFAULT_LEVELS,
  BINANCE_DEPTH_DEFAULT_LIMIT,
  BINANCE_DEPTH_DEFAULT_UPDATE_SPEED,
  BINANCE_DEPTH_LIMITS,
  BINANCE_DEPTH_REST_URL,
  BINANCE_DEPTH_UPDATE_SPEEDS,
  BINANCE_DEPTH_WS_URL,
  type BinanceOrderbookMarket,
} from "./constants";
import { fetchBinanceDepth } from "./fetch-binance-depth";
import { fetchBinanceSymbolFilters, type BinanceSymbolFilters } from "./fetch-binance-symbol-filters";
import { watchBinanceDepth } from "./watch-binance-depth";

/**
 * Parameters for {@link createBinanceOrderbookSource}.
 */
export interface BinanceOrderbookSourceParameters {
  /**
   * Which Binance market to read. Defaults to `"usd-m-futures"` — its symbols
   * are perpetual contracts, matching what a SYMMIO market actually is.
   */
  market?: BinanceOrderbookMarket;
  /** Override the REST host (a regional mirror, or your own caching proxy). */
  restUrl?: string;
  /**
   * Override the WebSocket endpoint.
   *
   * Only do this if you know the route serves depth. Binance routes futures
   * streams by class, and a depth subscription on the wrong route is
   * acknowledged and then silently never delivers — see {@link BINANCE_DEPTH_WS_URL}.
   */
  wsUrl?: string;
  /**
   * Diff-stream update speed in ms. Must be one the market serves — futures
   * `100 | 250 | 500`, spot `100 | 1000`. Defaults to the market's own default.
   */
  updateSpeed?: number;
  /**
   * Map a SYMMIO market name onto a Binance symbol, or return `undefined` when
   * the market has no Binance listing.
   *
   * Defaults to an upper-case identity mapping, which holds for current SYMMIO
   * deployments where market names are already Binance USD-M symbols. Override
   * it rather than relying on that coincidence if your deployment's names can
   * diverge — an unmapped name otherwise resolves to a symbol that does not
   * exist and the book simply stays empty.
   */
  resolveSymbol?: (marketName: string) => string | undefined;
  /**
   * WebSocket implementation for {@link OrderbookSource.watchOrderbook}.
   * Defaults to `globalThis.WebSocket`; pass the `ws` package in Node
   * environments without one.
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
      "No WebSocket implementation available. Pass `webSocketConstructor` to createBinanceOrderbookSource (e.g. the `ws` package in Node).",
    );
  }
  return ctor;
}

/**
 * Create an {@link OrderbookSource} backed by Binance depth.
 *
 * Snapshots come from the REST `/depth` endpoint and live updates from the
 * diff-depth WebSocket stream, combined into a continuously synchronized book
 * by {@link watchBinanceDepth}. Both are reachable directly from a browser —
 * Binance serves permissive CORS headers on market data, so no proxy or API key
 * is involved.
 *
 * Two caveats worth surfacing to users of a ladder built on this:
 * - The book is `priceBasis: "reference-exchange"`. It is Binance's resting
 *   liquidity, not the depth a SYMMIO trade executes against.
 * - `api.binance.com` and `fapi.binance.com` are blocked in some jurisdictions.
 *   Supply `restUrl`/`wsUrl` to route through your own proxy where that matters.
 *
 * @param parameters - Market selection, endpoint overrides, and symbol mapping.
 * @returns A source usable by `getOrderbookQueryOptions`, `useOrderbook`, or
 *   `useLiveOrderbook`.
 * @throws {SymmError} when `updateSpeed` is not one the chosen market serves.
 *
 * @example
 * ```ts
 * const source = createBinanceOrderbookSource();
 * const book = await source.getOrderbook({ marketName: "BTCUSDT", limit: 20 });
 * const unwatch = source.watchOrderbook!({
 *   marketName: "BTCUSDT",
 *   levels: 15,
 *   onOrderbook: (next) => render(next),
 * });
 * ```
 */
export function createBinanceOrderbookSource(parameters: BinanceOrderbookSourceParameters = {}): OrderbookSource {
  const market = parameters.market ?? "usd-m-futures";
  const restUrl = parameters.restUrl ?? BINANCE_DEPTH_REST_URL[market];
  const wsUrl = parameters.wsUrl ?? BINANCE_DEPTH_WS_URL[market];
  const resolveSymbol = parameters.resolveSymbol ?? defaultResolveSymbol;
  const supportedLimits = BINANCE_DEPTH_LIMITS[market];
  const defaultLimit = BINANCE_DEPTH_DEFAULT_LIMIT[market];
  const updateSpeed = parameters.updateSpeed ?? BINANCE_DEPTH_DEFAULT_UPDATE_SPEED[market];

  if (!BINANCE_DEPTH_UPDATE_SPEEDS[market].includes(updateSpeed)) {
    throw new SymmError(
      "validation",
      "UNSUPPORTED_DEPTH_UPDATE_SPEED",
      `Binance ${market} has no ${updateSpeed}ms depth stream. Supported: ${BINANCE_DEPTH_UPDATE_SPEEDS[market].join(", ")}ms.`,
    );
  }

  /**
   * `exchangeInfo` lists every contract on the venue and only changes on a
   * listing or delisting, so it is fetched once per source and shared by every
   * `getSymbol` call. The promise itself is cached so concurrent callers during
   * the first load share one request; a rejection clears it so a transient
   * failure does not poison the source for its lifetime.
   */
  let symbolFilters: Promise<Map<string, BinanceSymbolFilters>> | null = null;

  function getSymbolFilters(): Promise<Map<string, BinanceSymbolFilters>> {
    if (!symbolFilters) {
      symbolFilters = fetchBinanceSymbolFilters(restUrl, market).catch((err: unknown) => {
        symbolFilters = null;
        throw err;
      });
    }
    return symbolFilters;
  }

  function requireSourceSymbol(marketName: string): string {
    const symbol = resolveSymbol(marketName);
    if (!symbol) {
      throw new SymmError(
        "validation",
        "UNMAPPED_ORDERBOOK_MARKET",
        `No Binance symbol is mapped for market "${marketName}".`,
      );
    }
    return symbol;
  }

  function requireLimit(requested: number | undefined): number {
    const limit = requested ?? defaultLimit;
    if (!supportedLimits.includes(limit)) {
      throw new SymmError(
        "validation",
        "UNSUPPORTED_DEPTH_LIMIT",
        `Binance ${market} rejects a depth limit of ${limit}. Supported: ${supportedLimits.join(", ")}.`,
      );
    }
    return limit;
  }

  return {
    id: `binance:${market}`,
    priceBasis: "reference-exchange",
    supportedLimits,
    defaultLimit,

    async getSymbol(marketName: string): Promise<OrderbookSymbol | undefined> {
      const sourceSymbol = resolveSymbol(marketName);
      if (!sourceSymbol) return undefined;

      const filters = (await getSymbolFilters()).get(sourceSymbol.toUpperCase());
      if (!filters) return undefined;

      return {
        marketName,
        sourceSymbol: filters.symbol,
        baseAsset: filters.baseAsset,
        quoteAsset: filters.quoteAsset,
        pricePrecision: filters.pricePrecision,
        sizePrecision: filters.sizePrecision,
        tickSize: filters.tickSize,
      };
    },

    /**
     * `async` so that a validation failure arrives as a rejected promise rather
     * than a synchronous throw. A method typed `Promise<Orderbook>` that throws
     * before returning is hostile to callers: `.catch()` never sees it, and a
     * TanStack `queryFn` would blow up outside the query's own error handling.
     */
    async getOrderbook(getOrderbookParameters: GetOrderbookParameters): Promise<Orderbook> {
      const { marketName, limit, signal } = getOrderbookParameters;

      return fetchBinanceDepth({
        restUrl,
        market,
        symbol: requireSourceSymbol(marketName),
        marketName,
        limit: requireLimit(limit),
        signal,
      });
    },

    watchOrderbook(watchOrderbookParameters: WatchOrderbookParameters): Unwatch {
      const { marketName, limit, levels, onOrderbook, onResync, onStatusChange, onError } = watchOrderbookParameters;

      return watchBinanceDepth({
        restUrl,
        wsUrl,
        market,
        symbol: requireSourceSymbol(marketName),
        marketName,
        limit: requireLimit(limit),
        levels: levels && levels > 0 ? levels : BINANCE_DEPTH_DEFAULT_LEVELS,
        updateSpeed,
        webSocketConstructor: resolveWebSocketConstructor(parameters.webSocketConstructor),
        onOrderbook,
        onResync,
        onStatusChange,
        onError,
      });
    },
  };
}
