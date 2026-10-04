import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGaslessHttpContext } from "./http";
import {
  GASLESS_STATUS_READ_BURST,
  GASLESS_STATUS_READ_RATE_PER_SECOND,
  acquireGaslessStatusRead,
} from "./status-read-limiter";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "./test/config";

const SPACING_MS = 1_000 / GASLESS_STATUS_READ_RATE_PER_SECOND;

function context(overrides?: Partial<typeof TEST_GASLESS>, service: "operations" | "deposits" = "operations") {
  return buildGaslessHttpContext(GASLESS_TEST_CHAIN, { ...TEST_GASLESS, ...overrides }, service);
}

/** Resolve order of a batch of acquisitions, so pacing is observable without timing flake. */
function acquireMany(count: number, run: (index: number) => Promise<void>): { settled: number[] } {
  const settled: number[] = [];
  for (let index = 0; index < count; index += 1) {
    void run(index).then(() => settled.push(index));
  }
  return { settled };
}

describe("acquireGaslessStatusRead", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets a burst through immediately, then paces the rest", async () => {
    const { config } = gaslessTestConfig();
    const http = context();

    const { settled } = acquireMany(GASLESS_STATUS_READ_BURST + 2, () => acquireGaslessStatusRead(config, http, {}));

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveLength(GASLESS_STATUS_READ_BURST);

    await vi.advanceTimersByTimeAsync(SPACING_MS);
    expect(settled).toHaveLength(GASLESS_STATUS_READ_BURST + 1);

    await vi.advanceTimersByTimeAsync(SPACING_MS);
    expect(settled).toHaveLength(GASLESS_STATUS_READ_BURST + 2);
  });

  it("shares one budget across both services of a deployment — the gateway limits per instance", async () => {
    const { config } = gaslessTestConfig();

    const { settled } = acquireMany(GASLESS_STATUS_READ_BURST + 1, (index) =>
      acquireGaslessStatusRead(config, context(undefined, index % 2 === 0 ? "operations" : "deposits"), {}),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveLength(GASLESS_STATUS_READ_BURST);
  });

  it("gives a second deployment its own budget", async () => {
    const { config } = gaslessTestConfig();
    /** Same origin, a different protocol instance: a separate bucket at the gateway. */
    const other = context({ protocolInstance: "arbitrum-42161-other" });

    const { settled } = acquireMany(GASLESS_STATUS_READ_BURST, () => acquireGaslessStatusRead(config, context(), {}));
    const second = acquireMany(1, () => acquireGaslessStatusRead(config, other, {}));

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveLength(GASLESS_STATUS_READ_BURST);
    expect(second.settled).toHaveLength(1);
  });

  it("rejects a queued read as soon as its caller aborts", async () => {
    const { config } = gaslessTestConfig();
    const http = context();
    const controller = new AbortController();

    acquireMany(GASLESS_STATUS_READ_BURST, () => acquireGaslessStatusRead(config, http, {}));
    const queued = acquireGaslessStatusRead(config, http, { signal: controller.signal });
    const assertion = expect(queued).rejects.toMatchObject({ code: "GASLESS_WAIT_ABORTED" });

    controller.abort();
    await assertion;
  });

  it("refuses an already-aborted read without taking a slot", async () => {
    const { config } = gaslessTestConfig();
    const controller = new AbortController();
    controller.abort();

    await expect(acquireGaslessStatusRead(config, context(), { signal: controller.signal })).rejects.toMatchObject({
      code: "GASLESS_WAIT_ABORTED",
    });
  });
});
