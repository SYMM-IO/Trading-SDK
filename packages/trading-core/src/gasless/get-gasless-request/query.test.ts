import type { Query } from "@tanstack/query-core";
import { describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { operationRequestFixture } from "../test/records";
import { GaslessRequestStatus, type GaslessRequest } from "../types";
import { getGaslessRequestQueryOptions } from "./query";

function record(status: GaslessRequestStatus): GaslessRequest {
  return operationRequestFixture({ status });
}

/**
 * The shape TanStack hands a `refetchInterval` / `staleTime` function.
 *
 * `dataUpdatedAt` matters: the jitter is seeded from it, so it stands in for
 * "which fetch this state came from".
 */
function query(data?: GaslessRequest, dataUpdatedAt = 0) {
  return { state: { data, dataUpdatedAt, errorUpdatedAt: 0 } } as unknown as Query<
    GaslessRequest,
    Error,
    GaslessRequest,
    readonly unknown[]
  >;
}

function httpError(status: number, retryAfterMs?: number): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_STATUS_FETCH_FAILED",
    message: `${status}`,
    status,
    statusText: "",
    url: "https://gasless.test",
    method: "GET",
    retryAfterMs,
  });
}

function build(overrides?: Parameters<typeof getGaslessRequestQueryOptions>[1]["query"]) {
  const { config } = gaslessTestConfig();
  return getGaslessRequestQueryOptions(config, {
    chainId: GASLESS_TEST_CHAIN,
    requestId: "req-1",
    query: overrides,
  });
}

describe("getGaslessRequestQueryOptions — polling defaults", () => {
  it("polls on its own, so a request cannot silently freeze at its acceptance status", () => {
    const refetchInterval = build().refetchInterval as (q: unknown) => number | false;

    /** No data yet, and `queued` — the state a submit lands in; both poll in the 1–2 s band. */
    for (const delay of [refetchInterval(query()), refetchInterval(query(record(GaslessRequestStatus.QUEUED)))]) {
      expect(delay).toBeGreaterThanOrEqual(1_000);
      expect(delay).toBeLessThan(2_000);
    }
  });

  it("slows down once a transaction is broadcast", () => {
    const refetchInterval = build().refetchInterval as (q: unknown) => number | false;

    const delay = refetchInterval(query(record(GaslessRequestStatus.SUBMITTED)));
    expect(delay).toBeGreaterThanOrEqual(3_000);
    expect(delay).toBeLessThan(5_000);
  });

  it("jitters the cadence per fetch, so a page's concurrent workflows never poll in lockstep", () => {
    const refetchInterval = build().refetchInterval as (q: unknown) => number | false;

    /** One draw per settled fetch: the seed moves with `dataUpdatedAt`. */
    const delays = new Set(
      Array.from({ length: 50 }, (_, i) => refetchInterval(query(undefined, 1_700_000_000_000 + i))),
    );
    expect(delays.size).toBeGreaterThan(1);
  });

  it("returns one stable delay between fetches, so a re-render cannot restart the countdown", () => {
    const refetchInterval = build().refetchInterval as (q: unknown) => number | false;

    /**
     * TanStack recomputes `refetchInterval` on every `setOptions` and restarts
     * the timer when the value changed, so a delay that is re-drawn per call
     * never fires in a component that re-renders faster than the band.
     */
    const state = query(record(GaslessRequestStatus.QUEUED), 1_700_000_000_000);
    const delays = new Set(Array.from({ length: 50 }, () => refetchInterval(state)));
    expect(delays.size).toBe(1);
  });

  it("keeps polling under render pressure — the regression the per-call jitter caused", async () => {
    /**
     * TanStack skips every refetch timer when it believes it is on a server,
     * and it decides that from `window` at module-eval time — hence the stub
     * before the dynamic import.
     */
    vi.stubGlobal("window", globalThis);
    const { QueryClient, QueryObserver } = await import("@tanstack/query-core");
    vi.useFakeTimers();
    try {
      const { config } = gaslessTestConfig();
      const client = new QueryClient();
      const fetched = vi.fn(async () => record(GaslessRequestStatus.QUEUED));
      const options = () => ({
        ...getGaslessRequestQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" }),
        queryFn: fetched,
      });

      const observer = new QueryObserver(client, options());
      const unsubscribe = observer.subscribe(() => {});
      await vi.advanceTimersByTimeAsync(0);

      /** Sixty renders over six seconds: the 1–2 s band must still fire. */
      for (let i = 0; i < 60; i += 1) {
        observer.setOptions(options());
        await vi.advanceTimersByTimeAsync(100);
      }

      unsubscribe();
      client.clear();
      expect(fetched.mock.calls.length).toBeGreaterThan(2);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it.each([
    GaslessRequestStatus.SUCCEEDED,
    GaslessRequestStatus.REVERTED,
    GaslessRequestStatus.FAILED,
    GaslessRequestStatus.REJECTED,
  ])("stops polling at %s — a terminal record is immutable", (status) => {
    const refetchInterval = build().refetchInterval as (q: unknown) => number | false;

    expect(refetchInterval(query(record(status)))).toBe(false);
  });

  it("treats a terminal record as permanently fresh, so a remount does not refetch it", () => {
    const staleTime = build().staleTime as (q: unknown) => number;

    expect(staleTime(query(record(GaslessRequestStatus.SUCCEEDED)))).toBe(Infinity);
    expect(staleTime(query(record(GaslessRequestStatus.QUEUED)))).toBe(0);
  });

  it("tolerates the accept-vs-record race: three 404s are retried, the fourth is not", () => {
    const retry = build().retry as (failureCount: number, error: Error) => boolean;
    const notFound = new SymmApiError({
      code: "GASLESS_STATUS_FETCH_FAILED",
      message: "404",
      status: 404,
      statusText: "Not Found",
      url: "https://gasless.test",
      method: "GET",
    });

    expect(retry(0, notFound)).toBe(true);
    expect(retry(2, notFound)).toBe(true);
    expect(retry(3, notFound)).toBe(false);
  });

  it.each([0, 408, 429, 500, 502, 503, 504])(
    "retries a transient %i — a failed read is not a failed request",
    (status) => {
      const retry = build().retry as (failureCount: number, error: Error) => boolean;

      expect(retry(0, httpError(status))).toBe(true);
      expect(retry(7, httpError(status))).toBe(true);
      /** Bounded: blindness that outlasts the budget is surfaced, not hidden forever. */
      expect(retry(8, httpError(status))).toBe(false);
    },
  );

  it.each([401, 403, 422])("surfaces a definitive %i immediately — it is an answer, not a blind spot", (status) => {
    const retry = build().retry as (failureCount: number, error: Error) => boolean;

    expect(retry(0, httpError(status))).toBe(false);
  });

  it("does not retry an error that carries no HTTP status", () => {
    const retry = build().retry as (failureCount: number, error: Error) => boolean;

    expect(retry(0, new Error("not an http failure"))).toBe(false);
  });

  it("honors Retry-After over its own backoff, and never below it", () => {
    const retryDelay = build().retryDelay as (failureCount: number, error: Error) => number;

    const throttled = httpError(429, 12_000);
    expect(retryDelay(0, throttled)).toBe(12_000);

    /** Without a readable header (the cross-origin case) the jittered backoff decides. */
    const blind = httpError(429);
    const delay = retryDelay(0, blind);
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1_000);
  });

  it("lets a consumer override every default", () => {
    const options = build({ refetchInterval: 42, staleTime: 7, retry: false, retryDelay: 9 });

    expect(options.refetchInterval).toBe(42);
    expect(options.staleTime).toBe(7);
    expect(options.retry).toBe(false);
    expect(options.retryDelay).toBe(9);
  });

  it("keeps the action wired to the queryFn", async () => {
    const { config, readContract } = gaslessTestConfig();
    const options = getGaslessRequestQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    expect(readContract).not.toHaveBeenCalled();
    expect(options.queryKey[0]).toBe("getGaslessRequest");
    expect(typeof options.queryFn).toBe("function");
    vi.restoreAllMocks();
  });
});
