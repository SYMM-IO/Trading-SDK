import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { buildGaslessHttpContext } from "../http";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";

const get = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { get },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { getGaslessRequestTransactionsQueryKey, getGaslessRequestTransactionsQueryOptions } from "./query";

const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };

/** The shape TanStack hands a `refetchInterval` function; the jitter is seeded from its timestamps. */
function queryState(dataUpdatedAt = 1_700_000_000_000) {
  return { state: { dataUpdatedAt, errorUpdatedAt: 0 } };
}

function httpError(status: number, retryAfterMs?: number): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_TRANSACTIONS_FETCH_FAILED",
    message: `${status}`,
    status,
    statusText: "",
    url: "https://gasless.test",
    method: "GET",
    retryAfterMs,
  });
}

describe("getGaslessRequestTransactionsQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessRequestTransactionsQueryKey({ requestId: "req-1", service: undefined, configKey: "k" })).toEqual([
      "getGaslessRequestTransactions",
      { requestId: "req-1", configKey: "k" },
    ]);
  });

  it("accepts no options at all", () => {
    expect(getGaslessRequestTransactionsQueryKey()).toEqual(["getGaslessRequestTransactions", {}]);
  });
});

describe("getGaslessRequestTransactionsQueryOptions", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("keys the query by chain, request id, service, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessRequestTransactionsQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "dep-1",
      service: "deposits",
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessRequestTransactions",
      {
        chainId: GASLESS_TEST_CHAIN,
        requestId: "dep-1",
        service: "deposits",
        configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN),
      },
    ]);
  });

  it("gives the same request id a separate cache entry per service", () => {
    const { config } = gaslessTestConfig();

    const operations = getGaslessRequestTransactionsQueryOptions(config, { requestId: "id-1", service: "operations" });
    const deposits = getGaslessRequestTransactionsQueryOptions(config, { requestId: "id-1", service: "deposits" });

    expect(deposits.queryKey).not.toEqual(operations.queryKey);
  });

  it("defaults `service` into the key, so the writer and the reader share one entry", () => {
    const { config } = gaslessTestConfig();

    const implicit = getGaslessRequestTransactionsQueryOptions(config, { requestId: "req-1" });
    const explicit = getGaslessRequestTransactionsQueryOptions(config, { requestId: "req-1", service: "operations" });

    expect(implicit.queryKey).toEqual(explicit.queryKey);
    expect(implicit.queryKey[1]).toMatchObject({ service: "operations" });
  });

  it("does not poll on its own: without the record's status it has no stopping condition", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessRequestTransactionsQueryOptions(config, { requestId: "req-1" });

    expect(options.refetchInterval).toBe(false);
  });

  it("follows the record's cadence when handed its status, and stops when the record does", () => {
    const { config } = gaslessTestConfig();
    const interval = (status: GaslessRequestStatus) => {
      const options = getGaslessRequestTransactionsQueryOptions(config, { requestId: "req-1", status });
      return (options.refetchInterval as (q: unknown) => number | false)(queryState());
    };

    expect(interval(GaslessRequestStatus.QUEUED)).toBeGreaterThanOrEqual(1_000);
    expect(interval(GaslessRequestStatus.QUEUED)).toBeLessThan(2_000);
    expect(interval(GaslessRequestStatus.SUBMITTED)).toBeGreaterThanOrEqual(3_000);
    expect(interval(GaslessRequestStatus.SUBMITTED)).toBeLessThan(5_000);
    /** A terminal record's attempts are final — polling them bills for nothing. */
    expect(interval(GaslessRequestStatus.SUCCEEDED)).toBe(false);
  });

  it("returns one stable delay between fetches, so a re-render cannot restart the countdown", () => {
    const { config } = gaslessTestConfig();
    const options = getGaslessRequestTransactionsQueryOptions(config, {
      requestId: "req-1",
      status: GaslessRequestStatus.QUEUED,
    });
    const refetchInterval = options.refetchInterval as (q: unknown) => number | false;

    const state = queryState();
    expect(new Set(Array.from({ length: 50 }, () => refetchInterval(state))).size).toBe(1);
  });

  it("keeps the cadence status out of the key, so a status change does not fragment the cache", () => {
    const { config } = gaslessTestConfig();

    const queued = getGaslessRequestTransactionsQueryOptions(config, {
      requestId: "req-1",
      status: GaslessRequestStatus.QUEUED,
    });
    const submitted = getGaslessRequestTransactionsQueryOptions(config, {
      requestId: "req-1",
      status: GaslessRequestStatus.SUBMITTED,
    });

    expect(queued.queryKey).toEqual(submitted.queryKey);
    expect(queued.queryKey[1]).not.toHaveProperty("status");
  });

  it("retries a transient failure and surfaces a definitive one", () => {
    const { config } = gaslessTestConfig();
    const options = getGaslessRequestTransactionsQueryOptions(config, { requestId: "req-1" });
    const retry = options.retry as (failureCount: number, error: Error) => boolean;

    expect(retry(0, httpError(503))).toBe(true);
    expect(retry(0, httpError(404))).toBe(false);
  });

  it("honors Retry-After on a retried read", () => {
    const { config } = gaslessTestConfig();
    const options = getGaslessRequestTransactionsQueryOptions(config, { requestId: "req-1" });
    const retryDelay = options.retryDelay as (failureCount: number, error: Error) => number;

    expect(retryDelay(0, httpError(429, 9_000))).toBe(9_000);
  });

  it("passes TanStack's abort signal down to the HTTP call", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({ headers: HEADERS, data: [] });
    const controller = new AbortController();

    const options = getGaslessRequestTransactionsQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
    });
    await options.queryFn({ signal: controller.signal });

    expect(get).toHaveBeenCalledWith("/req-1/transactions", expect.objectContaining({ signal: controller.signal }));
  });

  it("honours query.enabled", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessRequestTransactionsQueryOptions(config, {
      requestId: "req-1",
      query: { enabled: false },
    });

    expect(options.enabled).toBe(false);
  });

  it("queryFn forwards the request id, service, and chain to the action", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({ headers: HEADERS, data: [] });
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessRequestTransactionsQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "dep-1",
      service: "deposits",
    });

    await expect(options.queryFn()).resolves.toEqual([]);
    /** A dropped `service` would silently read the operations service instead. */
    expect(get).toHaveBeenCalledWith(
      "/dep-1/transactions",
      expect.objectContaining({
        baseURL: buildGaslessHttpContext(GASLESS_TEST_CHAIN, TEST_GASLESS, "deposits").baseURL,
      }),
    );
  });
});
