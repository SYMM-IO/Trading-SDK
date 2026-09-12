import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildGaslessHttpContext } from "../http";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";

const get = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { get },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { getGaslessRequestTransactionsQueryKey, getGaslessRequestTransactionsQueryOptions } from "./query";

const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };

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
