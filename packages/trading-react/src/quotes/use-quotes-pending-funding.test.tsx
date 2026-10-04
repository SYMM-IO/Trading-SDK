import { QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, type Mock } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useQuotesPendingFunding } from "./use-quotes-pending-funding";

type InputQuote = Pick<UnifiedQuote, "quoteId" | "quoteStatus">;

const OPENED_ID = 7334n;
const CLOSE_PENDING_ID = 7335n;
const LOCKED_ID = 7336n;
const EXPIRED_ID = 7337n;

const OPENED: InputQuote = { quoteId: OPENED_ID, quoteStatus: QuoteStatus.OPENED };
const CLOSE_PENDING: InputQuote = { quoteId: CLOSE_PENDING_ID, quoteStatus: QuoteStatus.CLOSE_PENDING };
/** Locked by a solver but never opened — the view would report a meaningless, growing amount. */
const LOCKED: InputQuote = { quoteId: LOCKED_ID, quoteStatus: QuoteStatus.LOCKED };
/** Expired after a lock — `partyB` is never cleared, so the view still reports garbage. */
const EXPIRED: InputQuote = { quoteId: EXPIRED_ID, quoteStatus: QuoteStatus.EXPIRED };

/**
 * The diamond view's **cost-positive** debt per id (`> 0` → partyA pays). The
 * locked / expired amounts are deliberately huge, so reading them by mistake
 * would show up in the total.
 */
const DEBTS = new Map<bigint, bigint>([
  [OPENED_ID, 5_000000000000000000n],
  [CLOSE_PENDING_ID, -2_000000000000000000n],
  [LOCKED_ID, 999_000000000000000000n],
  [EXPIRED_ID, 999_000000000000000000n],
]);

/** Answer each `getQuoteFundingDebts` batch positionally, like the real view. */
function stubDebts(readContract: Mock): void {
  readContract.mockImplementation(async ({ args }: { args: [readonly bigint[]] }) =>
    args[0].map((quoteId) => DEBTS.get(quoteId) ?? 0n),
  );
}

/** Every id list the hook sent to the view, one entry per `eth_call`. */
function sentIdBatches(readContract: Mock): bigint[][] {
  return readContract.mock.calls.map(([call]) => [...(call as { args: [readonly bigint[]] }).args[0]]);
}

/** A promise the test resolves by hand, to hold the query in its loading state. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useQuotesPendingFunding", () => {
  it("reads only active positions — LOCKED and EXPIRED rows come back null and are never sent", async () => {
    const { config, readContract } = createMockSymmioConfig();
    stubDebts(readContract);

    const { result } = renderHookWithProviders(() =>
      useQuotesPendingFunding({ quotes: [OPENED, LOCKED, EXPIRED, CLOSE_PENDING], config }),
    );

    await waitFor(() => expect(result.current.pendingNetReceived).toBeDefined());

    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getQuoteFundingDebts",
        args: [[OPENED_ID, CLOSE_PENDING_ID]],
      }),
    );
    /** Negated to income-positive and aligned 1:1 with the input, `null` for the skipped rows. */
    expect(result.current.rows).toEqual([
      { quoteId: OPENED_ID, pendingNetReceived: -5_000000000000000000n },
      null,
      null,
      { quoteId: CLOSE_PENDING_ID, pendingNetReceived: 2_000000000000000000n },
    ]);
    expect(result.current.pendingNetReceived).toBe(-3_000000000000000000n);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("skips a row without a `quoteId` or without a known status", async () => {
    const { config, readContract } = createMockSymmioConfig();
    stubDebts(readContract);

    const { result } = renderHookWithProviders(() =>
      useQuotesPendingFunding({
        quotes: [{ quoteStatus: QuoteStatus.OPENED }, { quoteId: OPENED_ID }, CLOSE_PENDING],
        config,
      }),
    );

    await waitFor(() => expect(result.current.pendingNetReceived).toBeDefined());

    /** A status still `undefined` is not a known active status, even for an on-chain id. */
    expect(sentIdBatches(readContract)).toEqual([[CLOSE_PENDING_ID]]);
    expect(result.current.rows).toEqual([
      null,
      null,
      { quoteId: CLOSE_PENDING_ID, pendingNetReceived: 2_000000000000000000n },
    ]);
    expect(result.current.pendingNetReceived).toBe(2_000000000000000000n);
  });

  it("reads a repeated id once and sums it once", async () => {
    const { config, readContract } = createMockSymmioConfig();
    stubDebts(readContract);

    const { result } = renderHookWithProviders(() => useQuotesPendingFunding({ quotes: [OPENED, OPENED], config }));

    await waitFor(() => expect(result.current.pendingNetReceived).toBeDefined());

    expect(sentIdBatches(readContract)).toEqual([[OPENED_ID]]);
    /** Both duplicates render their row… */
    const row = { quoteId: OPENED_ID, pendingNetReceived: -5_000000000000000000n };
    expect(result.current.rows).toEqual([row, row]);
    /** …but the total counts the quote once, not twice. */
    expect(result.current.pendingNetReceived).toBe(-5_000000000000000000n);
  });

  it("forwards `batchSize` to core's sequential batches", async () => {
    const { config, readContract } = createMockSymmioConfig();
    stubDebts(readContract);

    const { result } = renderHookWithProviders(() =>
      useQuotesPendingFunding({ quotes: [CLOSE_PENDING, OPENED], batchSize: 1, config }),
    );

    await waitFor(() => expect(result.current.pendingNetReceived).toBeDefined());

    expect(sentIdBatches(readContract)).toEqual([[OPENED_ID], [CLOSE_PENDING_ID]]);
    expect(result.current.pendingNetReceived).toBe(-3_000000000000000000n);
  });

  it("returns 0n without reading when the list is empty", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() => useQuotesPendingFunding({ quotes: [], config }));

    expect(result.current.rows).toEqual([]);
    expect(result.current.pendingNetReceived).toBe(0n);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(readContract).not.toHaveBeenCalled();
  });

  it("returns one null row per input and 0n without reading when nothing is readable", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      useQuotesPendingFunding({ quotes: [LOCKED, EXPIRED, { quoteId: undefined }], config }),
    );

    expect(result.current.rows).toEqual([null, null, null]);
    expect(result.current.pendingNetReceived).toBe(0n);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("keeps the total undefined while the read is in flight", async () => {
    const { config, readContract } = createMockSymmioConfig();
    const gate = deferred<readonly bigint[]>();
    readContract.mockReturnValueOnce(gate.promise);

    const { result } = renderHookWithProviders(() => useQuotesPendingFunding({ quotes: [OPENED], config }));

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    /** Loading must not read as "no pending funding" — nothing has resolved yet. */
    expect(result.current.pendingNetReceived).toBeUndefined();
    expect(result.current.isFetching).toBe(true);
    expect(result.current.rows).toEqual([null]);

    gate.resolve([5_000000000000000000n]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pendingNetReceived).toBe(-5_000000000000000000n);
    expect(result.current.rows).toEqual([{ quoteId: OPENED_ID, pendingNetReceived: -5_000000000000000000n }]);
  });

  it("leaves the total unresolved when the data does not cover every readable id", async () => {
    const { config, readContract } = createMockSymmioConfig();
    /** A short answer: one debt for two ids, so core returns a row for the first id only. */
    readContract.mockResolvedValueOnce([5_000000000000000000n]);

    const { result } = renderHookWithProviders(() =>
      useQuotesPendingFunding({ quotes: [OPENED, CLOSE_PENDING], config }),
    );

    await waitFor(() => expect(result.current.rows[0]).not.toBeNull());
    expect(result.current.rows).toEqual([{ quoteId: OPENED_ID, pendingNetReceived: -5_000000000000000000n }, null]);
    /** A partial sum would pass for the total, so it stays `undefined`. */
    expect(result.current.pendingNetReceived).toBeUndefined();
  });

  it("normalizes a rejected read into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useQuotesPendingFunding({ quotes: [OPENED], config }));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBeInstanceOf(SymmioRequestError);
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
    expect(result.current.rows).toEqual([null]);
    expect(result.current.pendingNetReceived).toBeUndefined();
  });

  it("re-reads on `refetch`", async () => {
    const { config, readContract } = createMockSymmioConfig();
    stubDebts(readContract);

    const { result } = renderHookWithProviders(() => useQuotesPendingFunding({ quotes: [OPENED], config }));

    await waitFor(() => expect(result.current.pendingNetReceived).toBeDefined());
    expect(readContract).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());

    await waitFor(() => expect(readContract).toHaveBeenCalledTimes(2));
  });
});
