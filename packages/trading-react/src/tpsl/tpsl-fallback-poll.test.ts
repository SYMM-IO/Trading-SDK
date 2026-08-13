import type { QuoteTpSlRow } from "@symmio/trading-core";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchTpSlOrders = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, searchTpSlOrders };
});

import { createMockSymmioConfig } from "../test/test-utils";
import type { TpSlPollWaitingSide } from "./tpsl-fallback-poll";
import { startTpSlFallbackPoll } from "./tpsl-fallback-poll";
import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";

const VA = "0x00000000000000000000000000000000000000b1" as Address;
const OTHER_VA = "0x00000000000000000000000000000000000000b2" as Address;

function row(overrides: Record<string, unknown> = {}): QuoteTpSlRow {
  return {
    quote_id: 1,
    coh_quote_id: "coh-1",
    party_a_address: VA,
    symbol_id: 1,
    conditional_order_type: "take_profit",
    quantity: 10,
    price: 1,
    conditional_order_price: 150,
    order_type: 1,
    state: "new",
    action_price_type: "markPrice",
    close_status: null,
    position_type: 0,
    leverage: null,
    create_time: 1,
    modify_time: 1,
    ...overrides,
  } as unknown as QuoteTpSlRow;
}

function write(quoteId: bigint, account: Address = VA): TpSlPollWaitingSide {
  return { quoteId, side: "take_profit", intent: "write", account };
}

/** Let the pending timers and their awaited responses run. */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetTpSlStore();
  searchTpSlOrders.mockReset();
  searchTpSlOrders.mockResolvedValue({ orders: [], count: 0, isComplete: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startTpSlFallbackPoll", () => {
  it("leaves the report a full 30s alone before the first sweep", async () => {
    const { config } = createMockSymmioConfig();
    // No `delayMs`: the shipped default is what a run actually gets.
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)] });

    // The whole window a healthy report would land in, and then some.
    await advance(29_000);
    expect(searchTpSlOrders).not.toHaveBeenCalled();

    await advance(2_000);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);

    // Only then does it settle into its 2s cadence.
    await advance(2_100);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(2);
    poll.stop();
  });

  it("never sweeps at all when the report arrives inside the delay", async () => {
    const { config } = createMockSymmioConfig();
    let waiting: TpSlPollWaitingSide[] = [write(1n)];
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => waiting });

    // The WebSocket confirms after a second, as it does in the normal case.
    await advance(1_000);
    waiting = [];
    poll.stop();

    await advance(60_000);
    expect(searchTpSlOrders).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not fire immediately — the first sweep is one interval in", async () => {
    const { config } = createMockSymmioConfig();
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 100, intervalMs: 100 });

    await advance(50);
    expect(searchTpSlOrders).not.toHaveBeenCalled();

    await advance(60);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);
    poll.stop();
  });

  it("sends one request per account per tick, not one per leg", async () => {
    const { config } = createMockSymmioConfig();
    const poll = startTpSlFallbackPoll(config, {
      getWaiting: () => [write(1n), write(2n), write(3n)],
      delayMs: 100,
      intervalMs: 100,
    });

    await advance(110);

    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);
    expect(searchTpSlOrders.mock.calls[0]![1]).toMatchObject({ account: VA });
    poll.stop();
  });

  it("sweeps every distinct account a group spans", async () => {
    const { config } = createMockSymmioConfig();
    const poll = startTpSlFallbackPoll(config, {
      getWaiting: () => [write(1n, VA), write(2n, OTHER_VA)],
      delayMs: 100,
      intervalMs: 100,
    });

    await advance(110);

    const accounts = searchTpSlOrders.mock.calls.map((call) => (call[1] as { account: Address }).account);
    expect(accounts).toHaveLength(2);
    expect(accounts).toEqual(expect.arrayContaining([VA, OTHER_VA]));
    poll.stop();
  });

  it("stops as soon as nothing is waiting", async () => {
    const { config } = createMockSymmioConfig();
    let waiting: TpSlPollWaitingSide[] = [write(1n)];
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => waiting, delayMs: 100, intervalMs: 100 });

    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);

    waiting = [];
    await advance(500);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);
    poll.stop();
  });

  it("stops on `stop()` and leaves no timer behind", async () => {
    const { config } = createMockSymmioConfig();
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 100, intervalMs: 100 });

    await advance(110);
    poll.stop();
    await advance(1_000);

    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never stacks requests — a slow tick reschedules instead of overlapping", async () => {
    const { config } = createMockSymmioConfig();
    let release!: () => void;
    searchTpSlOrders.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ orders: [], count: 0, isComplete: true });
        }),
    );
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 100, intervalMs: 100 });

    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);

    // Three intervals pass while the first request is still in flight.
    await advance(400);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);

    release();
    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(2);
    poll.stop();
  });

  it("shares one loop and one request between two leases on the same account", async () => {
    const { config } = createMockSymmioConfig();
    const first = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 100, intervalMs: 100 });
    const second = startTpSlFallbackPoll(config, { getWaiting: () => [write(2n)], delayMs: 100, intervalMs: 100 });

    await advance(110);

    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);
    first.stop();

    // The surviving lease keeps the loop alive.
    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(2);
    second.stop();
    await advance(500);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(2);
  });

  it("backs off after a handler failure instead of hammering it", async () => {
    const { config } = createMockSymmioConfig();
    searchTpSlOrders.mockRejectedValue(new Error("handler down"));
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 100, intervalMs: 100 });

    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);

    // The next attempt is 200ms out, not 100ms.
    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(1);
    await advance(110);
    expect(searchTpSlOrders).toHaveBeenCalledTimes(2);
    poll.stop();
  });

  it("folds a sweep's rows into the shared store", async () => {
    const { config } = createMockSymmioConfig();
    useTpSlStore.getState().markConfirming(1n, "tp", { price: "150" });
    searchTpSlOrders.mockResolvedValue({
      orders: [row({ quote_id: 1, conditional_order_price: 150 })],
      count: 1,
      isComplete: true,
    });

    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 100, intervalMs: 100 });
    await advance(110);

    expect(useTpSlStore.getState().get(1n)?.tpState).toBe("new");
    poll.stop();
  });

  it("is a no-op when the interval is 0", async () => {
    const { config } = createMockSymmioConfig();
    const poll = startTpSlFallbackPoll(config, { getWaiting: () => [write(1n)], delayMs: 0, intervalMs: 0 });

    await advance(5_000);

    expect(searchTpSlOrders).not.toHaveBeenCalled();
    poll.stop();
  });
});
