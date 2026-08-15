import type { SolverId } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { assertPriceServiceProvider } from "../../price-service/assert-price-service-provider";
import { resolvePriceService } from "../../price-service/resolve-price-service";
import type { BinanceMarkPriceTick } from "../../price-service/types";
import { SymmError } from "../../shared/errors/symm-error";
import type { Unwatch } from "../notifications/types";
import { createReconnectingSocket } from "../socket/create-reconnecting-socket";
import { getSocketPool } from "../socket/get-socket-pool";
import type { SocketStatus } from "../socket/socket-status";
import { parseBinancePriceFrame } from "./parse-binance-price-frame";

/**
 * Parameters for {@link watchBinancePrices}.
 */
export interface WatchBinancePricesParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Solver whose price provider to subscribe to. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /**
   * Deliver ticks only for these market names (case-insensitive).
   *
   * **This filters delivery, it does not narrow the subscription.**
   * `!markPrice@arr@1s` is an all-market broadcast — there is no subscribe frame
   * and no way to ask for a subset — so the socket still receives every listed
   * symbol (~740) once per second regardless of what you pass here. The filter
   * runs per watcher after parsing.
   *
   * What it saves is everything downstream of `onPrices`: the callback fires
   * with 3 ticks instead of ~740, which is the difference between a handful of
   * state updates per second and a full-map churn. What it does **not** save is
   * bandwidth or the parse itself (one parse per frame is shared across all
   * watchers on the stream).
   *
   * Watchers with different filters still share one socket — the filter is
   * deliberately not part of the pool key, since filtering at the socket would
   * starve siblings.
   *
   * If you need to actually reduce what crosses the wire, Binance also serves
   * per-symbol streams (`<symbol>@markPrice@1s`); point `priceService.wsUrl` at
   * one and omit `names`. That trades the shared all-market socket for one
   * connection per symbol.
   */
  names?: readonly string[];
  /**
   * Called for every parsed (and filtered) batch of ticks.
   *
   * **Treat the batch and its ticks as read-only.** One frame is parsed once and
   * shared across every watcher on the stream, so mutating a tick in place would
   * be visible to the others. Copy before transforming.
   */
  onPrices: (prices: BinanceMarkPriceTick[]) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/** @internal */
function toPricesError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError("api", "PRICES_SOCKET_ERROR", `Prices socket error${cause ? `: ${cause.message}` : "."}`, {
    cause,
  });
}

/**
 * Subscribe to Binance USD-M Futures' all-market mark-price stream.
 *
 * The endpoint is broadcast-only — there is no subscribe frame; every connected
 * client receives the same 1/sec array of ticks. Watchers sharing the same
 * `wsUrl` share one underlying socket; it closes when the last watcher
 * unwatches.
 *
 * The URL is taken verbatim from `priceService.wsUrl` and dialled as-is. The
 * registry default is `wss://fstream.binance.com/market/ws/!markPrice@arr@1s`:
 * Binance's *documented* `/ws/<stream>` form was measured to connect and then
 * never push a frame, so using it would ship a feed that reports `open` and
 * silently never ticks. Keeping the whole URL in config means a routing change
 * or a proxy is a one-value override.
 *
 * Binance force-closes a connection every 24h with a clean code; the shared
 * reconnecting socket never inspects the close code, so that reconnects like any
 * other drop with no extra handling.
 *
 * @param config - The SDK config.
 * @param parameters - Handlers, optional chain/solver override, optional name filter.
 * @returns An unwatch function that releases this subscription.
 * @throws {SymmError} synchronously when the chain is unsupported, the resolved
 *   price service is not Binance (`UNSUPPORTED_BY_PRICE_SERVICE`), there is no
 *   `wsUrl` configured, or no `WebSocket` implementation exists.
 *
 * @example
 * ```ts
 * const unwatch = watchBinancePrices(config, {
 *   solverId: "rasa",
 *   names: ["BTCUSDT"],
 *   onPrices: (ticks) => console.log(ticks[0]?.markPrice),
 * });
 * ```
 */
export function watchBinancePrices(config: Config, parameters: WatchBinancePricesParameters): Unwatch {
  const { chainId, solverId, names, onPrices, onStatusChange, onError } = parameters;

  const priceService = resolvePriceService(config, { chainId, solverId });
  assertPriceServiceProvider(priceService, "binance", "watchBinancePrices");

  const wsUrl = priceService.wsUrl;
  if (!wsUrl) {
    throw new SymmError("config", "PRICES_WS_NOT_CONFIGURED", "Chain has no `priceService.wsUrl` configured.");
  }
  const webSocketConstructor = config.getWebSocketConstructor();

  /**
   * The filter is per-listener and deliberately absent from the pool key: the
   * pool fans one frame to every listener, so filtering at the socket would
   * starve siblings that asked for different names.
   */
  const wanted = names?.length ? new Set(names.map((name) => name.trim().toUpperCase())) : undefined;

  const key = `${wsUrl}|binance-mark-prices`;

  return getSocketPool(config).acquire(
    key,
    (handlers) =>
      createReconnectingSocket({
        url: wsUrl,
        webSocketConstructor,
        getOpenMessages: () => [],
        onMessage: handlers.onMessage,
        onStatusChange: handlers.onStatusChange,
        onError: handlers.onError,
      }),
    {
      onMessage: (data) => {
        let ticks;
        try {
          ticks = parseBinancePriceFrame(data);
        } catch (err) {
          onError?.(toPricesError(err));
          return;
        }
        if (!ticks || ticks.length === 0) return;

        const delivered = wanted ? ticks.filter((tick) => wanted.has(tick.name.toUpperCase())) : ticks;
        if (delivered.length === 0) return;

        try {
          onPrices(delivered);
        } catch (err) {
          onError?.(toPricesError(err));
        }
      },
      onStatusChange,
      onError: (event) => onError?.(toPricesError(event)),
    },
  );
}
