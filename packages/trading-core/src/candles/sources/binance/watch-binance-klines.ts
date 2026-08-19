import { SymmError } from "../../../shared/errors/symm-error";
import type { WebSocketConstructor } from "../../../shared/types/websocket";
import type { Unwatch } from "../../../websocket/notifications/watch-notifications";
import type { SocketStatus } from "../../../websocket/socket";
import { createReconnectingSocket } from "../../../websocket/socket/create-reconnecting-socket";
import type { Candle, CandleUpdateMeta } from "../../types";
import { parseBinanceKlineEvent, type RawBinanceKlineEvent } from "./parse-kline";

/**
 * Parameters for {@link watchBinanceKlines}.
 */
export interface WatchBinanceKlinesParameters {
  /** Combined-stream WebSocket endpoint (`.../stream`). */
  wsUrl: string;
  /** Binance symbol, upper-case (e.g. `"BTCUSDT"`). */
  symbol: string;
  /** Binance interval string (e.g. `"1m"`). */
  interval: string;
  /** WebSocket implementation to dial with. */
  webSocketConstructor: WebSocketConstructor;
  /** Called for each update to the bar, and once more when it closes. */
  onCandle: (candle: Candle, meta: CandleUpdateMeta) => void;
  /** Called after a reconnect, when bars may have been missed. */
  onReset?: () => void;
  /** Called whenever the connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/** Shape of a Binance combined-stream frame carrying a kline event. */
interface BinanceKlineFrame {
  stream?: string;
  data?: { e?: string; s?: string; k?: RawBinanceKlineEvent };
  e?: string;
  s?: string;
  k?: RawBinanceKlineEvent;
}

function toKlinesError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError(
    "api",
    "BINANCE_KLINES_SOCKET_ERROR",
    `Binance klines socket error${cause ? `: ${cause.message}` : "."}`,
    {
      cause,
    },
  );
}

/**
 * Stream live bar updates for one Binance symbol and interval.
 *
 * Each call opens its own connection. That is deliberate at this scale — a
 * chart holds exactly one subscription — and keeps the reconnect and
 * unsubscribe paths trivially correct. Binance drops idle connections after 24
 * hours; the reconnecting socket re-dials and re-sends the SUBSCRIBE frame, and
 * `onReset` fires so the consumer refetches the bars missed in the gap.
 *
 * Inbound frames are matched on **both** symbol and interval. Matching on
 * symbol alone lets two charts on different intervals feed each other's series.
 *
 * @param parameters - Endpoint, symbol, interval, and handlers.
 * @returns An unwatch function that closes the connection.
 *
 * @example
 * ```ts
 * const unwatch = watchBinanceKlines({
 *   wsUrl: "wss://fstream.binance.com/stream",
 *   symbol: "BTCUSDT",
 *   interval: "1m",
 *   webSocketConstructor: WebSocket,
 *   onCandle: (candle, { closed }) => console.log(candle.close, closed),
 * });
 * ```
 */
export function watchBinanceKlines(parameters: WatchBinanceKlinesParameters): Unwatch {
  const { wsUrl, symbol, interval, webSocketConstructor, onCandle, onReset, onStatusChange, onError } = parameters;

  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
  const subscribeMessage = JSON.stringify({ method: "SUBSCRIBE", params: [streamName], id: 1 });

  /**
   * The first open establishes the stream; every later one follows a drop, so
   * the consumer's cached bars have a hole in them and must be refetched.
   */
  let hasOpened = false;

  const socket = createReconnectingSocket({
    url: wsUrl,
    webSocketConstructor,
    /**
     * Sent on every (re)open, so the subscription survives reconnects without
     * the consumer re-subscribing.
     */
    getOpenMessages: () => [subscribeMessage],
    onOpen: () => {
      if (hasOpened) onReset?.();
      hasOpened = true;
    },
    onStatusChange,
    onError: (event) => onError?.(toKlinesError(event)),
    onMessage: (data) => {
      let frame: BinanceKlineFrame;
      try {
        frame = JSON.parse(String(data)) as BinanceKlineFrame;
      } catch (err) {
        onError?.(toKlinesError(err));
        return;
      }

      /** Combined streams wrap the event in `data`; raw streams do not. */
      const event = frame.data ?? frame;
      if (event.e !== "kline" || !event.k) return;

      /** Guard against cross-feeding a chart from another symbol or interval. */
      if (event.s?.toUpperCase() !== symbol.toUpperCase()) return;
      if (event.k.i !== interval) return;

      try {
        onCandle(parseBinanceKlineEvent(event.k), { closed: event.k.x === true });
      } catch (err) {
        onError?.(toKlinesError(err));
      }
    },
  });

  return () => socket.close();
}
