import type { GetQuoteFundingReturnType, QuoteFundingData } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

/**
 * The core query factory is mocked so the test exercises only the hook's
 * batching / de-duping / aggregation contract — no subgraph, no network.
 */
const getQuoteFundingQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getQuoteFundingQueryOptions };
});

import { useQuotesFunding } from "./use-quotes-funding";

const QUOTE_ID = 7334n;
const OTHER_QUOTE_ID = 7335n;
const MISSING_QUOTE_ID = 7336n;

const ROW: QuoteFundingData = {
  quoteId: QUOTE_ID,
  paid: 30_000000000000000000n,
  received: 10_000000000000000000n,
  netReceived: -20_000000000000000000n,
};

const OTHER_ROW: QuoteFundingData = {
  quoteId: OTHER_QUOTE_ID,
  paid: 1_000000000000000000n,
  received: 4_000000000000000000n,
  netReceived: 3_000000000000000000n,
};

/** A promise the test resolves by hand, to hold the query in its loading state. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Script the mocked core factory with a `queryFn` that yields `data`, keying the
 * cache on the ids the hook actually requested so each id set is its own entry.
 */
function mockQuery(queryFn: () => Promise<GetQuoteFundingReturnType>): { requestedIds: () => bigint[][] } {
  const calls: bigint[][] = [];
  getQuoteFundingQueryOptions.mockImplementation((_config: unknown, options: { quoteIds: readonly bigint[] }) => {
    calls.push([...options.quoteIds]);
    return {
      queryKey: ["getQuoteFunding", options.quoteIds.map(String)],
      enabled: options.quoteIds.length > 0,
      queryFn,
    };
  });
  return { requestedIds: () => calls };
}

describe("useQuotesFunding", () => {
  afterEach(() => {
    getQuoteFundingQueryOptions.mockReset();
  });

  it("fetches a repeated quote id once and sums it once", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue({ rows: [ROW], missingQuoteIds: [] });
    const { requestedIds } = mockQuery(queryFn);

    const { result } = renderHookWithProviders(() =>
      useQuotesFunding({ quotes: [{ quoteId: QUOTE_ID }, { quoteId: QUOTE_ID }], config }),
    );

    await waitFor(() => expect(result.current.rows[0]).not.toBeNull());

    /** One round-trip for the de-duped id… */
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(requestedIds().at(-1)).toEqual([QUOTE_ID]);
    /** …and the funding counted once, not twice. */
    expect(result.current.paid).toBe(ROW.paid);
    expect(result.current.received).toBe(ROW.received);
    expect(result.current.netReceived).toBe(ROW.netReceived);
    /** `rows` still mirrors the input, so both duplicates render their row. */
    expect(result.current.rows).toEqual([ROW, ROW]);
  });

  it("ignores a duplicate row for the same id in the response", async () => {
    const { config } = createMockSymmioConfig();
    mockQuery(vi.fn().mockResolvedValue({ rows: [ROW, ROW], missingQuoteIds: [] }));

    const { result } = renderHookWithProviders(() => useQuotesFunding({ quotes: [{ quoteId: QUOTE_ID }], config }));

    await waitFor(() => expect(result.current.rows[0]).not.toBeNull());
    expect(result.current.netReceived).toBe(ROW.netReceived);
  });

  it("keeps `netReceived = received − paid` negative when the position net-paid", async () => {
    const { config } = createMockSymmioConfig();
    mockQuery(vi.fn().mockResolvedValue({ rows: [ROW, OTHER_ROW], missingQuoteIds: [] }));

    const { result } = renderHookWithProviders(() =>
      useQuotesFunding({ quotes: [{ quoteId: QUOTE_ID }, { quoteId: OTHER_QUOTE_ID }], config }),
    );

    await waitFor(() => expect(result.current.rows[1]).not.toBeNull());

    expect(result.current.paid).toBe(ROW.paid + OTHER_ROW.paid);
    expect(result.current.received).toBe(ROW.received + OTHER_ROW.received);
    expect(result.current.netReceived).toBe(result.current.received - result.current.paid);
    expect(result.current.netReceived < 0n).toBe(true);
  });

  it("returns one `rows` entry per input quote when every quote is off-chain", () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn();
    mockQuery(queryFn);

    const { result } = renderHookWithProviders(() =>
      useQuotesFunding({ quotes: [{ quoteId: undefined }, { quoteId: undefined }, {}], config }),
    );

    /** The 1:1 alignment with `quotes` holds even though nothing is fetched. */
    expect(result.current.rows).toEqual([null, null, null]);
    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.missingQuoteIds).toEqual([]);
    expect(result.current.netReceived).toBe(0n);
  });

  it("keeps `rows` aligned with mixed on-chain and off-chain input", async () => {
    const { config } = createMockSymmioConfig();
    mockQuery(vi.fn().mockResolvedValue({ rows: [ROW], missingQuoteIds: [] }));

    const { result } = renderHookWithProviders(() =>
      useQuotesFunding({ quotes: [{ quoteId: undefined }, { quoteId: QUOTE_ID }], config }),
    );

    await waitFor(() => expect(result.current.rows[1]).not.toBeNull());
    expect(result.current.rows).toEqual([null, ROW]);
  });

  it("reports every requested id as missing while the query is in flight", async () => {
    const { config } = createMockSymmioConfig();
    const gate = deferred<GetQuoteFundingReturnType>();
    mockQuery(() => gate.promise);

    const { result } = renderHookWithProviders(() =>
      useQuotesFunding({ quotes: [{ quoteId: QUOTE_ID }, { quoteId: MISSING_QUOTE_ID }], config }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    /** Loading must not read as "nothing missing" — nothing has resolved yet. */
    expect(result.current.missingQuoteIds).toEqual([QUOTE_ID, MISSING_QUOTE_ID]);
    expect(result.current.rows).toEqual([null, null]);

    gate.resolve({ rows: [ROW], missingQuoteIds: [MISSING_QUOTE_ID] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    /** Once settled, only the ids the subgraph really withheld are reported. */
    expect(result.current.missingQuoteIds).toEqual([MISSING_QUOTE_ID]);
    expect(result.current.rows).toEqual([ROW, null]);
    expect(result.current.netReceived).toBe(ROW.netReceived);
  });

  it("reports every requested id as missing when the query fails", async () => {
    const { config } = createMockSymmioConfig();
    mockQuery(vi.fn().mockRejectedValue(new Error("subgraph down")));

    const { result } = renderHookWithProviders(() => useQuotesFunding({ quotes: [{ quoteId: QUOTE_ID }], config }));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toHaveProperty("kind");
    expect(result.current.missingQuoteIds).toEqual([QUOTE_ID]);
    expect(result.current.rows).toEqual([null]);
  });
});
