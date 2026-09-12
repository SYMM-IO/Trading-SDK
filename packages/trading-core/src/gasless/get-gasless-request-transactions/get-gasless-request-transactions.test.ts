import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { buildGaslessHttpContext } from "../http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import type { GaslessWireTransactionAttempt } from "../wire-types";

const get = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { get },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { getGaslessRequestTransactions } from "./get-gasless-request-transactions";

const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
const CONFIRMED_HASH = `0x${"ab".repeat(32)}` as const;

/** A replaced-then-confirmed broadcast: the first attempt carries no hash and explicit nulls elsewhere. */
const ATTEMPTS: GaslessWireTransactionAttempt[] = [
  {
    id: "att-1",
    workflow: "operations",
    entity_id: "req-1",
    attempt_number: 1,
    status: "failed",
    receipt: null,
    error_code: "NONCE_TOO_LOW",
    error_message: "replacement underpriced",
    created_at: "2026-09-04T00:00:00Z",
    updated_at: "2026-09-04T00:00:01Z",
  },
  {
    id: "att-2",
    workflow: "operations",
    entity_id: "req-1",
    tx_hash: CONFIRMED_HASH,
    attempt_number: 2,
    status: "confirmed",
    error_code: null,
    error_message: null,
    created_at: "2026-09-04T00:00:02Z",
    updated_at: "2026-09-04T00:00:03Z",
  },
];

function baseURL(service: "operations" | "deposits"): string {
  return buildGaslessHttpContext(GASLESS_TEST_CHAIN, TEST_GASLESS, service).baseURL;
}

describe("getGaslessRequestTransactions", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("lists the attempts from the operations service and normalizes absent fields to null", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({ headers: HEADERS, data: ATTEMPTS });

    const attempts = await getGaslessRequestTransactions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    expect(get).toHaveBeenCalledWith(
      "/req-1/transactions",
      expect.objectContaining({
        baseURL: baseURL("operations"),
        headers: expect.objectContaining({ Authorization: `Bearer ${TEST_GASLESS.apiKey}` }),
      }),
    );
    expect(attempts).toEqual([
      {
        id: "att-1",
        txHash: null,
        attemptNumber: 1,
        status: "failed",
        errorCode: "NONCE_TOO_LOW",
        errorMessage: "replacement underpriced",
      },
      {
        id: "att-2",
        txHash: CONFIRMED_HASH,
        attemptNumber: 2,
        status: "confirmed",
        errorCode: null,
        errorMessage: null,
      },
    ]);
  });

  it("reads a deposit settlement's attempts from the deposits service", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({ headers: HEADERS, data: [] });

    const attempts = await getGaslessRequestTransactions(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "dep-1",
      service: "deposits",
    });

    expect(attempts).toEqual([]);
    expect(get).toHaveBeenCalledWith("/dep-1/transactions", expect.objectContaining({ baseURL: baseURL("deposits") }));
  });

  it("encodes the request id into a single path segment", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({ headers: HEADERS, data: [] });

    await getGaslessRequestTransactions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "../req 1?all=#" });

    /** Nothing in the id may climb out of the path or smuggle in a query. */
    expect(get.mock.calls[0]?.[0]).toBe("/..%2Freq%201%3Fall%3D%23/transactions");
  });

  it("normalizes an HTTP failure into SymmApiError with the status preserved", async () => {
    const { config } = gaslessTestConfig();
    get.mockRejectedValue({
      isAxiosError: true,
      message: "not found",
      response: { status: 404, statusText: "Not Found", data: { detail: { code: "NOT_FOUND" } } },
      config: { url: "/req-1/transactions", method: "get" },
    });

    const attempts = getGaslessRequestTransactions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    await expect(attempts).rejects.toBeInstanceOf(SymmApiError);
    await expect(attempts).rejects.toMatchObject({ code: "GASLESS_TRANSACTIONS_FETCH_FAILED", status: 404 });
  });
});
