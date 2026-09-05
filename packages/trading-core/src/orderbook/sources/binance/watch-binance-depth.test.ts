import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../../shared/test/fake-web-socket";
import type { SocketStatus } from "../../../websocket/socket";
import type { Orderbook, OrderbookResyncReason } from "../../types";
import type { BinanceOrderbookMarket } from "./constants";

const fetchDepth = vi.hoisted(() => vi.fn());
vi.mock("./fetch-binance-depth", () => ({ fetchBinanceDepth: fetchDepth }));

import { watchBinanceDepth } from "./watch-binance-depth";

/** Flush pending microtasks, including the snapshot promise chain. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

function snapshot(lastUpdateId: number, overrides: Partial<Orderbook> = {}): Orderbook {
  return {
    marketName: "BTCUSDT",
    bids: [
      { price: 100, size: 1 },
      { price: 99, size: 2 },
    ],
    asks: [
      { price: 101, size: 1 },
      { price: 102, size: 2 },
    ],
    lastUpdateId,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

interface DepthEventOverrides {
  U: number;
  u: number;
  pu?: number;
  b?: [string, string][];
  a?: [string, string][];
  s?: string;
  T?: number;
}

function frame(event: DepthEventOverrides): unknown {
  return {
    stream: "btcusdt@depth@500ms",
    data: {
      e: "depthUpdate",
      E: 1_700_000_000_001,
      T: event.T ?? 1_700_000_000_001,
      s: event.s ?? "BTCUSDT",
      U: event.U,
      u: event.u,
      ...(event.pu === undefined ? {} : { pu: event.pu }),
      b: event.b ?? [],
      a: event.a ?? [],
    },
  };
}

interface Harness {
  fake: ReturnType<typeof createFakeWebSocket>;
  books: Orderbook[];
  resyncs: OrderbookResyncReason[];
  statuses: SocketStatus[];
  errors: SymmError[];
  unwatch: () => void;
  latest(): Orderbook | undefined;
}

function setup(options: { market?: BinanceOrderbookMarket; levels?: number; limit?: number } = {}): Harness {
  const fake = createFakeWebSocket();
  const books: Orderbook[] = [];
  const resyncs: OrderbookResyncReason[] = [];
  const statuses: SocketStatus[] = [];
  const errors: SymmError[] = [];

  const unwatch = watchBinanceDepth({
    restUrl: "https://fapi.binance.com",
    wsUrl: "wss://fstream.binance.com/public/stream",
    market: options.market ?? "usd-m-futures",
    symbol: "BTCUSDT",
    marketName: "BTCUSDT",
    limit: options.limit ?? 1000,
    levels: options.levels ?? 50,
    updateSpeed: 500,
    webSocketConstructor: fake.WebSocket,
    onOrderbook: (book) => books.push(book),
    onResync: (reason) => resyncs.push(reason),
    onStatusChange: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
  });

  return { fake, books, resyncs, statuses, errors, unwatch, latest: () => books.at(-1) };
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchDepth.mockReset();
  fetchDepth.mockResolvedValue(snapshot(100));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("watchBinanceDepth — connection", () => {
  it("dials the depth route and subscribes with the market's stream name", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.fake.last().url).toBe("wss://fstream.binance.com/public/stream");
    expect(JSON.parse(harness.fake.last().sent[0]!)).toEqual({
      method: "SUBSCRIBE",
      params: ["btcusdt@depth@500ms"],
      id: 1,
    });

    harness.unwatch();
  });

  it("subscribes before requesting the snapshot, so no update falls in the gap", async () => {
    const harness = setup();

    harness.fake.last().simulateOpen();
    /** The SUBSCRIBE frame is sent synchronously on open; the fetch is only queued. */
    expect(harness.fake.last().sent).toHaveLength(1);
    expect(fetchDepth).toHaveBeenCalledTimes(1);

    await flush();
    harness.unwatch();
  });

  it("requests the snapshot with the configured depth", async () => {
    const harness = setup({ limit: 100 });
    harness.fake.last().simulateOpen();
    await flush();

    expect(fetchDepth).toHaveBeenCalledWith(expect.objectContaining({ symbol: "BTCUSDT", limit: 100 }));

    harness.unwatch();
  });

  it("forwards socket status changes", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.statuses).toEqual(["open"]);

    harness.fake.last().simulateClose();
    expect(harness.statuses).toContain("reconnecting");

    harness.unwatch();
  });

  it("announces the first build as `initial`", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.resyncs).toEqual(["initial"]);

    harness.unwatch();
  });
});

describe("watchBinanceDepth — seeding", () => {
  it("emits the snapshot once it lands", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.latest()).toMatchObject({
      marketName: "BTCUSDT",
      bids: [
        { price: 100, size: 1 },
        { price: 99, size: 2 },
      ],
      asks: [
        { price: 101, size: 1 },
        { price: 102, size: 2 },
      ],
      lastUpdateId: 100,
    });

    harness.unwatch();
  });

  it("applies updates buffered while the snapshot was in flight", async () => {
    let resolveSnapshot: ((book: Orderbook) => void) | undefined;
    fetchDepth.mockReturnValue(
      new Promise<Orderbook>((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    const harness = setup();
    harness.fake.last().simulateOpen();

    harness.fake.last().simulateMessage(frame({ U: 95, u: 105, pu: 90, b: [["100", "9"]] }));
    harness.fake.last().simulateMessage(frame({ U: 106, u: 110, pu: 105, a: [["101", "8"]] }));
    expect(harness.books).toHaveLength(0);

    resolveSnapshot!(snapshot(100));
    await flush();

    expect(harness.books).toHaveLength(1);
    expect(harness.latest()).toMatchObject({
      bids: [
        { price: 100, size: 9 },
        { price: 99, size: 2 },
      ],
      asks: [
        { price: 101, size: 8 },
        { price: 102, size: 2 },
      ],
      lastUpdateId: 110,
    });

    harness.unwatch();
  });

  it("discards buffered updates the snapshot already covers", async () => {
    let resolveSnapshot: ((book: Orderbook) => void) | undefined;
    fetchDepth.mockReturnValue(
      new Promise<Orderbook>((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    const harness = setup();
    harness.fake.last().simulateOpen();

    /** Stale: fully behind the snapshot, and its level must not be applied. */
    harness.fake.last().simulateMessage(frame({ U: 10, u: 20, pu: 5, b: [["100", "999"]] }));
    harness.fake.last().simulateMessage(frame({ U: 95, u: 105, pu: 90, b: [["99", "7"]] }));

    resolveSnapshot!(snapshot(100));
    await flush();

    expect(harness.latest()!.bids).toEqual([
      { price: 100, size: 1 },
      { price: 99, size: 7 },
    ]);

    harness.unwatch();
  });

  it("refetches when the snapshot is older than the buffered updates can bridge", async () => {
    fetchDepth.mockResolvedValueOnce(snapshot(100)).mockResolvedValueOnce(snapshot(300));

    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    /** `U` starts past the snapshot: the window between them was never covered. */
    harness.fake.last().simulateMessage(frame({ U: 200, u: 210, pu: 199 }));
    await flush();

    expect(harness.resyncs).toEqual(["initial", "stale-snapshot"]);
    expect(fetchDepth).toHaveBeenCalledTimes(2);
    expect(harness.latest()!.lastUpdateId).toBe(300);

    harness.unwatch();
  });

  it("accepts a first update that straddles the snapshot sequence number", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 110, pu: 99, b: [["100", "5"]] }));
    await flush();

    expect(harness.resyncs).toEqual(["initial"]);
    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 5 });

    harness.unwatch();
  });
});

describe("watchBinanceDepth — applying updates", () => {
  it("replaces a level with the absolute quantity", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["100", "42"]] }));
    await flush();

    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 42 });

    harness.unwatch();
  });

  it("removes a level on a zero quantity", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["100", "0"]] }));
    await flush();

    expect(harness.latest()!.bids).toEqual([{ price: 99, size: 2 }]);

    harness.unwatch();
  });

  it("tolerates a removal for a level it never held", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["55", "0"]] }));
    await flush();

    expect(harness.errors).toHaveLength(0);
    expect(harness.latest()!.bids).toHaveLength(2);

    harness.unwatch();
  });

  it("inserts a new level in price order", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["99.5", "3"]], a: [["101.5", "4"]] }));
    await flush();

    expect(harness.latest()!.bids.map((level) => level.price)).toEqual([100, 99.5, 99]);
    expect(harness.latest()!.asks.map((level) => level.price)).toEqual([101, 101.5, 102]);

    harness.unwatch();
  });

  it("advances lastUpdateId and timestamp with each applied update", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 150, pu: 100, T: 1_700_000_009_999 }));
    await flush();

    expect(harness.latest()).toMatchObject({ lastUpdateId: 150, timestamp: 1_700_000_009_999 });

    harness.unwatch();
  });

  it("emits once per applied update", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();
    const afterSeed = harness.books.length;

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100 }));
    harness.fake.last().simulateMessage(frame({ U: 102, u: 103, pu: 101 }));
    await flush();

    expect(harness.books.length - afterSeed).toBe(2);

    harness.unwatch();
  });

  it("emits a fresh object each time, so a held reference never mutates", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    const seeded = harness.latest()!;
    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["100", "77"]] }));
    await flush();

    expect(seeded.bids[0]).toEqual({ price: 100, size: 1 });
    expect(harness.latest()).not.toBe(seeded);

    harness.unwatch();
  });

  it("trims each side to the requested level count", async () => {
    fetchDepth.mockResolvedValue(
      snapshot(100, {
        bids: Array.from({ length: 40 }, (_, index) => ({ price: 100 - index, size: 1 })),
        asks: Array.from({ length: 40 }, (_, index) => ({ price: 101 + index, size: 1 })),
      }),
    );

    const harness = setup({ levels: 5 });
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.latest()!.bids).toHaveLength(5);
    expect(harness.latest()!.asks).toHaveLength(5);
    expect(harness.latest()!.bids[0]!.price).toBe(100);
    expect(harness.latest()!.asks[0]!.price).toBe(101);

    harness.unwatch();
  });

  it("keeps tracking levels beyond the emitted window", async () => {
    fetchDepth.mockResolvedValue(
      snapshot(100, {
        bids: Array.from({ length: 10 }, (_, index) => ({ price: 100 - index, size: 1 })),
        asks: [{ price: 101, size: 1 }],
      }),
    );

    const harness = setup({ levels: 2 });
    harness.fake.last().simulateOpen();
    await flush();

    /** Clearing the two visible levels must reveal the third, not an empty side. */
    harness.fake.last().simulateMessage(
      frame({
        U: 100,
        u: 101,
        pu: 100,
        b: [
          ["100", "0"],
          ["99", "0"],
        ],
      }),
    );
    await flush();

    expect(harness.latest()!.bids).toEqual([
      { price: 98, size: 1 },
      { price: 97, size: 1 },
    ]);

    harness.unwatch();
  });
});

describe("watchBinanceDepth — futures continuity", () => {
  it("chains on `pu`, not on `U`", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    /**
     * The regression this whole state machine exists for. On live USD-M futures
     * `U` routinely jumps hundreds of ids past the previous `u` while `pu`
     * chains exactly. A `U === prev.u + 1` rule would resync on every event.
     */
    harness.fake.last().simulateMessage(frame({ U: 100, u: 200, pu: 100, b: [["100", "3"]] }));
    harness.fake.last().simulateMessage(frame({ U: 412, u: 500, pu: 200, b: [["100", "4"]] }));
    harness.fake.last().simulateMessage(frame({ U: 1012, u: 1100, pu: 500, b: [["100", "5"]] }));
    await flush();

    expect(harness.resyncs).toEqual(["initial"]);
    expect(fetchDepth).toHaveBeenCalledTimes(1);
    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 5 });

    harness.unwatch();
  });

  it("resyncs when `pu` does not match the last applied update", async () => {
    fetchDepth.mockResolvedValueOnce(snapshot(100)).mockResolvedValueOnce(snapshot(900));

    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 200, pu: 100 }));
    await flush();
    /** `pu` should be 200; 199 means an update was missed. */
    harness.fake.last().simulateMessage(frame({ U: 201, u: 300, pu: 199 }));
    await flush();

    expect(harness.resyncs).toEqual(["initial", "sequence-gap"]);
    expect(fetchDepth).toHaveBeenCalledTimes(2);
    expect(harness.latest()!.lastUpdateId).toBe(900);

    harness.unwatch();
  });

  it("does not apply the update that broke continuity", async () => {
    fetchDepth.mockResolvedValueOnce(snapshot(100)).mockResolvedValueOnce(snapshot(900));

    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 201, u: 300, pu: 199, b: [["100", "666"]] }));
    await flush();

    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 1 });

    harness.unwatch();
  });

  it("stops draining the buffer at the first gap", async () => {
    let resolveSnapshot: ((book: Orderbook) => void) | undefined;
    fetchDepth
      .mockReturnValueOnce(
        new Promise<Orderbook>((resolve) => {
          resolveSnapshot = resolve;
        }),
      )
      .mockResolvedValue(snapshot(900));

    const harness = setup();
    harness.fake.last().simulateOpen();

    harness.fake.last().simulateMessage(frame({ U: 95, u: 105, pu: 90, b: [["100", "3"]] }));
    /** Breaks the chain — `pu` should be 105. */
    harness.fake.last().simulateMessage(frame({ U: 106, u: 110, pu: 999, b: [["100", "4"]] }));
    harness.fake.last().simulateMessage(frame({ U: 111, u: 120, pu: 110, b: [["100", "5"]] }));

    resolveSnapshot!(snapshot(100));
    await flush();

    expect(harness.resyncs).toEqual(["initial", "sequence-gap"]);
    expect(harness.latest()!.lastUpdateId).toBe(900);

    harness.unwatch();
  });

  it("skips an update the book has already passed", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 200, pu: 100 }));
    await flush();
    const before = harness.books.length;

    harness.fake.last().simulateMessage(frame({ U: 50, u: 60, pu: 40, b: [["100", "888"]] }));
    await flush();

    expect(harness.books).toHaveLength(before);
    expect(harness.resyncs).toEqual(["initial"]);

    harness.unwatch();
  });
});

describe("watchBinanceDepth — spot continuity", () => {
  it("chains on `U`, since spot sends no `pu`", async () => {
    const harness = setup({ market: "spot" });
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 105, b: [["100", "3"]] }));
    harness.fake.last().simulateMessage(frame({ U: 106, u: 110, b: [["100", "4"]] }));
    await flush();

    expect(harness.resyncs).toEqual(["initial"]);
    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 4 });

    harness.unwatch();
  });

  it("resyncs when `U` skips past the next expected id", async () => {
    fetchDepth.mockResolvedValueOnce(snapshot(100)).mockResolvedValueOnce(snapshot(900));

    const harness = setup({ market: "spot" });
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 105 }));
    await flush();
    harness.fake.last().simulateMessage(frame({ U: 200, u: 210 }));
    await flush();

    expect(harness.resyncs).toEqual(["initial", "sequence-gap"]);

    harness.unwatch();
  });

  it("tolerates an update that overlaps the last one", async () => {
    const harness = setup({ market: "spot" });
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage(frame({ U: 100, u: 105 }));
    await flush();
    /** Overlapping rather than skipping — no information is missing. */
    harness.fake.last().simulateMessage(frame({ U: 104, u: 110 }));
    await flush();

    expect(harness.resyncs).toEqual(["initial"]);
    expect(harness.latest()!.lastUpdateId).toBe(110);

    harness.unwatch();
  });
});

describe("watchBinanceDepth — reconnect", () => {
  it("resubscribes and rebuilds the book after a drop", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateClose();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(harness.fake.instances).toHaveLength(2);
    harness.fake.last().simulateOpen();
    await flush();

    expect(JSON.parse(harness.fake.last().sent[0]!)).toMatchObject({ params: ["btcusdt@depth@500ms"] });
    expect(harness.resyncs).toEqual(["initial", "reconnect"]);
    expect(fetchDepth).toHaveBeenCalledTimes(2);

    harness.unwatch();
  });

  it("does not carry stale levels across a reconnect", async () => {
    fetchDepth
      .mockResolvedValueOnce(snapshot(100, { bids: [{ price: 100, size: 1 }], asks: [{ price: 101, size: 1 }] }))
      .mockResolvedValueOnce(snapshot(500, { bids: [{ price: 50, size: 9 }], asks: [{ price: 51, size: 9 }] }));

    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateClose();
    await vi.advanceTimersByTimeAsync(5_000);
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.latest()!.bids).toEqual([{ price: 50, size: 9 }]);
    expect(harness.latest()!.asks).toEqual([{ price: 51, size: 9 }]);

    harness.unwatch();
  });
});

describe("watchBinanceDepth — errors and filtering", () => {
  it("reports a snapshot failure and retries", async () => {
    fetchDepth.mockRejectedValueOnce(new SymmError("api", "BOOM", "snapshot failed")).mockResolvedValue(snapshot(400));

    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0]!.code).toBe("BOOM");
    expect(harness.books).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(fetchDepth).toHaveBeenCalledTimes(2);
    expect(harness.latest()!.lastUpdateId).toBe(400);

    harness.unwatch();
  });

  it("reports a malformed frame without tearing down the subscription", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateMessage("not json");
    await flush();

    expect(harness.errors).toHaveLength(1);

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["100", "6"]] }));
    await flush();

    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 6 });

    harness.unwatch();
  });

  it("reports a non-numeric level without applying it", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();
    const before = harness.books.length;

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["100", "abc"]] }));
    await flush();

    expect(harness.errors.at(-1)!.code).toBe("INVALID_BINANCE_DEPTH");
    expect(harness.books).toHaveLength(before);

    harness.unwatch();
  });

  it("ignores frames for another symbol", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();
    const before = harness.books.length;

    harness.fake.last().simulateMessage(frame({ U: 100, u: 101, pu: 100, s: "ETHUSDT", b: [["100", "999"]] }));
    await flush();

    expect(harness.books).toHaveLength(before);

    harness.unwatch();
  });

  it("ignores non-depth frames such as the subscribe acknowledgement", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();
    const before = harness.books.length;

    harness.fake.last().simulateMessage({ result: null, id: 1 });
    harness.fake.last().simulateMessage({ stream: "btcusdt@kline_1m", data: { e: "kline" } });
    await flush();

    expect(harness.books).toHaveLength(before);
    expect(harness.errors).toHaveLength(0);

    harness.unwatch();
  });

  it("forwards a transport error", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.fake.last().simulateError(new Error("socket blew up"));

    expect(harness.errors.at(-1)!.code).toBe("BINANCE_DEPTH_SOCKET_ERROR");
    expect(harness.errors.at(-1)!.message).toContain("socket blew up");

    harness.unwatch();
  });
});

describe("watchBinanceDepth — teardown", () => {
  it("stops emitting after unwatch", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();
    const socket = harness.fake.last();

    harness.unwatch();
    socket.simulateMessage(frame({ U: 100, u: 101, pu: 100, b: [["100", "9"]] }));
    await flush();

    expect(harness.latest()!.bids[0]).toEqual({ price: 100, size: 1 });
  });

  it("discards a snapshot that lands after unwatch", async () => {
    let resolveSnapshot: ((book: Orderbook) => void) | undefined;
    fetchDepth.mockReturnValue(
      new Promise<Orderbook>((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    const harness = setup();
    harness.fake.last().simulateOpen();
    harness.unwatch();

    resolveSnapshot!(snapshot(100));
    await flush();

    expect(harness.books).toHaveLength(0);
  });

  it("cancels a pending snapshot retry", async () => {
    fetchDepth.mockRejectedValue(new SymmError("api", "BOOM", "snapshot failed"));

    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.unwatch();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(fetchDepth).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect after unwatch", async () => {
    const harness = setup();
    harness.fake.last().simulateOpen();
    await flush();

    harness.unwatch();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(harness.fake.instances).toHaveLength(1);
  });
});
