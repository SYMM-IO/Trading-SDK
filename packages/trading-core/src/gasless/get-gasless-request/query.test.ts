import type { Query } from "@tanstack/query-core";
import { describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessRequest } from "../types";
import { getGaslessRequestQueryOptions } from "./query";

function record(status: GaslessRequestStatus): GaslessRequest {
  return {
    requestId: "req-1",
    status,
    txHash: null,
    errorCode: null,
    errorMessage: null,
    operationType: "grantDelegation",
    idempotencyKey: null,
  };
}

/** The shape TanStack hands a `refetchInterval` / `staleTime` function. */
function query(data?: GaslessRequest) {
  return { state: { data } } as unknown as Query<GaslessRequest, Error, GaslessRequest, readonly unknown[]>;
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

    /** No data yet, and `queued` — the state a submit lands in. */
    expect(refetchInterval(query())).toBe(1_500);
    expect(refetchInterval(query(record(GaslessRequestStatus.QUEUED)))).toBe(1_500);
  });

  it("slows down once a transaction is broadcast", () => {
    const refetchInterval = build().refetchInterval as (q: unknown) => number | false;

    expect(refetchInterval(query(record(GaslessRequestStatus.SUBMITTED)))).toBe(3_000);
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

  it("does not retry a non-404 failure", () => {
    const retry = build().retry as (failureCount: number, error: Error) => boolean;
    const serverError = new SymmApiError({
      code: "GASLESS_STATUS_FETCH_FAILED",
      message: "500",
      status: 500,
      statusText: "Server Error",
      url: "https://gasless.test",
      method: "GET",
    });

    expect(retry(0, serverError)).toBe(false);
    expect(retry(0, new Error("network"))).toBe(false);
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
