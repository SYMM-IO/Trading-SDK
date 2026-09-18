import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { buildGaslessHttpContext } from "../http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { GaslessTransactionAttemptStatus } from "../types";
import { TransactionAttemptStatus } from "../types/generated/gasless-operations";
import type { GaslessWireTransactionAttempt } from "../wire-types";

const get = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { get },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { getGaslessRequestTransactions } from "./get-gasless-request-transactions";

const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
const REPLACED_HASH = `0x${"cd".repeat(32)}` as const;
const CONFIRMED_HASH = `0x${"ab".repeat(32)}` as const;

/**
 * A replaced-then-confirmed broadcast. The schema requires `tx_hash` on every
 * attempt; the confirmed attempt omits its optional error fields.
 */
const ATTEMPTS: GaslessWireTransactionAttempt[] = [
  {
    id: "att-1",
    workflow: "operations",
    entity_id: "req-1",
    tx_hash: REPLACED_HASH,
    attempt_number: 1,
    status: TransactionAttemptStatus.failed,
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
    status: TransactionAttemptStatus.confirmed,
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
        txHash: REPLACED_HASH,
        attemptNumber: 1,
        status: GaslessTransactionAttemptStatus.FAILED,
        requestId: "req-1",
        workflow: "operations",
        receipt: null,
        errorCode: "NONCE_TOO_LOW",
        errorMessage: "replacement underpriced",
        createdAt: "2026-09-04T00:00:00Z",
        updatedAt: "2026-09-04T00:00:01Z",
      },
      {
        id: "att-2",
        txHash: CONFIRMED_HASH,
        attemptNumber: 2,
        status: GaslessTransactionAttemptStatus.CONFIRMED,
        requestId: "req-1",
        workflow: "operations",
        receipt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-09-04T00:00:02Z",
        updatedAt: "2026-09-04T00:00:03Z",
      },
    ]);
  });

  it("keeps the stored receipt as the service reported it", async () => {
    const { config } = gaslessTestConfig();
    const receipt = { status: "0x1", blockNumber: "0x2a" };
    get.mockResolvedValue({ headers: HEADERS, data: [{ ...ATTEMPTS[1], receipt }] });

    const [attempt] = await getGaslessRequestTransactions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    expect(attempt?.receipt).toEqual(receipt);
  });

  it("refuses an attempt status outside the documented set, instead of mistyping it", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({ headers: HEADERS, data: [{ ...ATTEMPTS[1], status: "pending" }] });

    await expect(
      getGaslessRequestTransactions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" }),
    ).rejects.toMatchObject({ code: "GASLESS_ATTEMPT_STATUS_UNKNOWN" });
  });

  it("still normalizes an attempt row without a hash to a null txHash", async () => {
    const { config } = gaslessTestConfig();
    /** Untyped on purpose: the schema requires `tx_hash`, but the normalizer tolerates a row without one. */
    const row = {
      id: "att-0",
      workflow: "operations",
      entity_id: "req-1",
      attempt_number: 1,
      status: "submitted",
      created_at: "2026-09-04T00:00:00Z",
      updated_at: "2026-09-04T00:00:00Z",
    };
    get.mockResolvedValue({ headers: HEADERS, data: [row] });

    const [attempt] = await getGaslessRequestTransactions(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    expect(attempt?.txHash).toBeNull();
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
