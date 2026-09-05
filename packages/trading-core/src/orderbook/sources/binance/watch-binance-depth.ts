import { SymmError } from "../../../shared/errors/symm-error";
import type { WebSocketConstructor } from "../../../shared/types/websocket";
import type { Unwatch } from "../../../websocket/notifications/watch-notifications";
import type { SocketStatus } from "../../../websocket/socket";
import { createReconnectingSocket } from "../../../websocket/socket/create-reconnecting-socket";
import type { Orderbook, OrderbookLevel, OrderbookResyncReason } from "../../types";
import { BINANCE_DEPTH_MAX_BUFFERED_EVENTS, type BinanceOrderbookMarket } from "./constants";
import { fetchBinanceDepth } from "./fetch-binance-depth";
import { parseBinanceDepthLevels, type RawBinanceDepthEvent } from "./parse-depth";

/**
 * Delay before retrying a snapshot that failed.
 *
 * The socket keeps buffering throughout, so a retry resumes from a live buffer
 * rather than a cold start.
 */
const SNAPSHOT_RETRY_DELAY_MS = 1_000;

/**
 * Upper bound on levels tracked per side.
 *
 * The book self-cleans — a filled or cancelled level arrives as a zero and is
 * removed — so this never trips in normal operation. It bounds memory against
 * a venue that leaks far-out levels, and dropping the worst-priced levels is
 * safe: a later update removing one is explicitly documented as normal, and
 * only the top {@link WatchBinanceDepthParameters.levels} are ever emitted.
 */
const MAX_TRACKED_LEVELS_PER_SIDE = 5_000;

/**
 * Parameters for {@link watchBinanceDepth}.
 */
export interface WatchBinanceDepthParameters {
  /** REST host for snapshots, without a trailing slash. */
  restUrl: string;
  /** Combined-stream WebSocket endpoint. Must be the market's depth route. */
  wsUrl: string;
  /** Which Binance market to read. Decides the continuity rule. */
  market: BinanceOrderbookMarket;
  /** Binance symbol, upper-case (e.g. `"BTCUSDT"`). */
  symbol: string;
  /** Market name as SYMMIO names it, carried onto every emitted book. */
  marketName: string;
  /** Snapshot depth per side. */
  limit: number;
  /** Levels per side to emit on each update. */
  levels: number;
  /** Diff-stream update speed in ms; part of the stream name. */
  updateSpeed: number;
  /** WebSocket implementation to dial with. */
  webSocketConstructor: WebSocketConstructor;
  /** Called with a complete book on every applied update. */
  onOrderbook: (orderbook: Orderbook) => void;
  /** Called when the book is about to be rebuilt. */
  onResync?: (reason: OrderbookResyncReason) => void;
  /** Called whenever the connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport, parse, or snapshot error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/** Combined-stream envelope, or the bare event on a raw stream. */
interface BinanceDepthFrame {
  stream?: string;
  data?: RawBinanceDepthEvent;
  e?: string;
  s?: string;
  U?: number;
  u?: number;
}

function toDepthError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError(
    "api",
    "BINANCE_DEPTH_SOCKET_ERROR",
    `Binance depth socket error${cause ? `: ${cause.message}` : "."}`,
    {
      cause,
    },
  );
}

/**
 * Whether an update fails to chain onto the book's current sequence position.
 *
 * The rule is **per market and not interchangeable**. Futures chains on `pu`,
 * which carries the previous event's `u`; its `U` routinely jumps hundreds of
 * ids past the previous `u`, so the spot rule applied to futures reports a gap
 * on essentially every event. Spot has no `pu` and chains on `U`, tolerating
 * overlap (`U <= lastUpdateId + 1`) because two events may cover the same id.
 */
function hasSequenceGap(market: BinanceOrderbookMarket, event: RawBinanceDepthEvent, lastUpdateId: number): boolean {
  if (market === "usd-m-futures" && typeof event.pu === "number") {
    return event.pu !== lastUpdateId;
  }
  return event.U > lastUpdateId + 1;
}

/**
 * Track a Binance order book in real time, correctly synchronized.
 *
 * This implements Binance's documented local-order-book procedure end to end:
 * subscribe first and buffer, then snapshot, discard updates the snapshot
 * already covers, require the first applied update to straddle the snapshot's
 * sequence number, apply absolute quantities with zero meaning removal, and
 * verify every subsequent update chains onto the last. Any break — a missed
 * update, a reconnect, a snapshot that arrives older than the buffer — throws
 * the local book away and rebuilds it, announcing the rebuild through
 * `onResync` so a consumer can show the book as stale rather than trust a
 * silently diverged ladder.
 *
 * Each call opens its own connection. That is deliberate at this scale — one
 * ladder holds one subscription — and keeps the reconnect and unsubscribe paths
 * trivially correct. Binance drops idle connections after 24 hours; the
 * reconnecting socket re-dials, re-sends SUBSCRIBE, and the book resyncs.
 *
 * @param parameters - Endpoints, symbol, depth, and handlers.
 * @returns An unwatch function that closes the connection and cancels any
 *   in-flight snapshot.
 *
 * @example
 * ```ts
 * const unwatch = watchBinanceDepth({
 *   restUrl: "https://fapi.binance.com",
 *   wsUrl: "wss://fstream.binance.com/public/stream",
 *   market: "usd-m-futures",
 *   symbol: "BTCUSDT",
 *   marketName: "BTCUSDT",
 *   limit: 1000,
 *   levels: 20,
 *   updateSpeed: 500,
 *   webSocketConstructor: WebSocket,
 *   onOrderbook: (book) => render(book),
 *   onResync: (reason) => markStale(reason),
 * });
 * ```
 */
export function watchBinanceDepth(parameters: WatchBinanceDepthParameters): Unwatch {
  const {
    restUrl,
    wsUrl,
    market,
    symbol,
    marketName,
    limit,
    levels,
    updateSpeed,
    webSocketConstructor,
    onOrderbook,
    onResync,
    onStatusChange,
    onError,
  } = parameters;

  const streamName = `${symbol.toLowerCase()}@depth@${updateSpeed}ms`;
  const subscribeMessage = JSON.stringify({ method: "SUBSCRIBE", params: [streamName], id: 1 });
  const upperSymbol = symbol.toUpperCase();

  const bids = new Map<number, number>();
  const asks = new Map<number, number>();

  let lastUpdateId = 0;
  let timestamp = 0;
  let phase: "buffering" | "live" | "closed" = "buffering";
  /**
   * Set immediately after seeding. The first update applied to a fresh
   * snapshot is checked against the snapshot's own sequence number rather than
   * against the previous update — there is no previous update to chain onto.
   */
  let expectFirstEvent = false;
  let buffer: RawBinanceDepthEvent[] = [];
  /** Invalidates the results of a snapshot request that a newer sync superseded. */
  let syncToken = 0;
  let abortController: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function applyLevels(side: Map<number, number>, updates: readonly OrderbookLevel[]): void {
    for (const { price, size } of updates) {
      /** A zero quantity is the venue's instruction to remove the level. */
      if (size <= 0) side.delete(price);
      else side.set(price, size);
    }
  }

  function pruneSide(side: Map<number, number>, direction: "desc" | "asc"): void {
    if (side.size <= MAX_TRACKED_LEVELS_PER_SIDE) return;

    const sorted = sortPrices(side, direction).slice(0, MAX_TRACKED_LEVELS_PER_SIDE);
    const kept = new Set(sorted);
    for (const price of side.keys()) {
      if (!kept.has(price)) side.delete(price);
    }
  }

  function sortPrices(side: Map<number, number>, direction: "desc" | "asc"): number[] {
    const prices = Array.from(side.keys());
    prices.sort((a, b) => (direction === "desc" ? b - a : a - b));
    return prices;
  }

  function topLevels(side: Map<number, number>, direction: "desc" | "asc"): OrderbookLevel[] {
    return sortPrices(side, direction)
      .slice(0, levels)
      .map((price) => ({ price, size: side.get(price)! }));
  }

  function emit(): void {
    onOrderbook({
      marketName,
      bids: topLevels(bids, "desc"),
      asks: topLevels(asks, "asc"),
      lastUpdateId,
      timestamp,
    });
  }

  /**
   * Outcome of offering one update to the book.
   *
   * - `applied` — the book moved; emit.
   * - `skipped` — the update carried nothing new, so re-emitting an identical
   *   book would only cost the consumer a render.
   * - `resyncing` — the update could not be trusted; a rebuild is under way and
   *   the caller must stop draining.
   */
  type ApplyOutcome = "applied" | "skipped" | "resyncing";

  function applyEvent(event: RawBinanceDepthEvent): ApplyOutcome {
    /** Already covered by the snapshot or by an earlier update. */
    if (event.u < lastUpdateId) return "skipped";

    if (expectFirstEvent) {
      /**
       * The first update must straddle the snapshot: it has to start at or
       * before the snapshot's sequence number and end at or after it. An
       * update starting past the snapshot means the gap between them was never
       * covered, so the snapshot is unusable.
       */
      if (event.U > lastUpdateId) {
        startSync("stale-snapshot");
        return "resyncing";
      }
      expectFirstEvent = false;
    } else if (hasSequenceGap(market, event, lastUpdateId)) {
      startSync("sequence-gap");
      return "resyncing";
    }

    applyLevels(bids, parseBinanceDepthLevels(event.b));
    applyLevels(asks, parseBinanceDepthLevels(event.a));
    pruneSide(bids, "desc");
    pruneSide(asks, "asc");

    lastUpdateId = event.u;
    timestamp = event.T ?? event.E ?? timestamp;
    return "applied";
  }

  function seed(snapshot: Orderbook): void {
    bids.clear();
    asks.clear();
    for (const level of snapshot.bids) bids.set(level.price, level.size);
    for (const level of snapshot.asks) asks.set(level.price, level.size);

    lastUpdateId = snapshot.lastUpdateId;
    timestamp = snapshot.timestamp;

    /** Updates the snapshot already reflects carry no information. */
    const pending = buffer.filter((event) => event.u >= snapshot.lastUpdateId);
    buffer = [];
    phase = "live";
    expectFirstEvent = true;

    for (const event of pending) {
      if (applyEvent(event) === "resyncing") return;
    }

    emit();
  }

  function startSync(reason: OrderbookResyncReason): void {
    if (phase === "closed") return;

    phase = "buffering";
    expectFirstEvent = false;
    onResync?.(reason);

    const token = ++syncToken;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    fetchBinanceDepth({ restUrl, market, symbol, marketName, limit, signal: controller.signal })
      .then((snapshot) => {
        /** A newer sync, or an unwatch, superseded this request. */
        if (token !== syncToken || phase === "closed") return;
        seed(snapshot);
      })
      .catch((err: unknown) => {
        if (token !== syncToken || phase === "closed") return;
        if (controller.signal.aborted) return;

        onError?.(toDepthError(err));

        /**
         * The socket is still buffering, so a retry resumes from live updates.
         * `initial` rather than the original reason: from the book's point of
         * view every retry is another attempt at the same first build.
         */
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          if (phase !== "closed") startSync("initial");
        }, SNAPSHOT_RETRY_DELAY_MS);
      });
  }

  let hasOpened = false;

  const socket = createReconnectingSocket({
    url: wsUrl,
    webSocketConstructor,
    /** Re-sent on every (re)open, so the subscription survives reconnects. */
    getOpenMessages: () => [subscribeMessage],
    onOpen: () => {
      /**
       * Subscribe-then-snapshot, in that order. Fetching first — as the
       * reference implementation this replaces did — leaves the window between
       * the snapshot and the first buffered update uncovered, and nothing
       * downstream can detect the hole.
       */
      startSync(hasOpened ? "reconnect" : "initial");
      hasOpened = true;
    },
    onStatusChange,
    onError: (event) => onError?.(toDepthError(event)),
    onMessage: (data) => {
      if (phase === "closed") return;

      let frame: BinanceDepthFrame;
      try {
        frame = JSON.parse(String(data)) as BinanceDepthFrame;
      } catch (err) {
        onError?.(toDepthError(err));
        return;
      }

      const event = (frame.data ?? frame) as RawBinanceDepthEvent;
      if (event.e !== "depthUpdate") return;
      /** Guard against feeding this book from another symbol's stream. */
      if (event.s?.toUpperCase() !== upperSymbol) return;
      if (typeof event.U !== "number" || typeof event.u !== "number") return;

      try {
        if (phase === "buffering") {
          buffer.push(event);
          /**
           * Only reachable if a snapshot never resolves. The oldest events go
           * first, which is the pair the continuity check will catch — a silent
           * partial application would be the dangerous outcome, and cannot happen.
           */
          if (buffer.length > BINANCE_DEPTH_MAX_BUFFERED_EVENTS) buffer.shift();
          return;
        }

        if (applyEvent(event) === "applied") emit();
      } catch (err) {
        onError?.(toDepthError(err));
      }
    },
  });

  return () => {
    phase = "closed";
    syncToken += 1;
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    retryTimer = undefined;
    abortController?.abort();
    abortController = undefined;
    buffer = [];
    socket.close();
  };
}
