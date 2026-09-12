import { QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useQuotePendingFunding } from "./use-quote-pending-funding";

type InputQuote = Pick<UnifiedQuote, "quoteId" | "quoteStatus">;

const QUOTE_ID = 7334n;
/** The diamond view's cost-positive debt for {@link QUOTE_ID}: the position owes 4. */
const DEBT = 4_000000000000000000n;

describe("useQuotePendingFunding", () => {
  it("reads an active quote and returns its income-positive row", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([DEBT]);

    const { result } = renderHookWithProviders(() =>
      useQuotePendingFunding({ quote: { quoteId: QUOTE_ID, quoteStatus: QuoteStatus.OPENED }, config }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data).toEqual({ quoteId: QUOTE_ID, pendingNetReceived: -DEBT });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getQuoteFundingDebts",
        args: [[QUOTE_ID]],
      }),
    );
  });

  it("does not read while the quote is undefined", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() => useQuotePendingFunding({ config }));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("does not read a quote that is not an active position", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      useQuotePendingFunding({ quote: { quoteId: QUOTE_ID, quoteStatus: QuoteStatus.LOCKED }, config }),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("forwards TanStack `query` overrides to the batch read", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      useQuotePendingFunding({
        quote: { quoteId: QUOTE_ID, quoteStatus: QuoteStatus.OPENED },
        query: { enabled: false },
        config,
      }),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("stays referentially stable across rerenders with a fresh-but-equal quote", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValue([DEBT]);

    const { result, rerender } = renderHookWithProviders(
      ({ quote }: { quote: InputQuote }) => useQuotePendingFunding({ quote, config }),
      { initialProps: { quote: { quoteId: QUOTE_ID, quoteStatus: QuoteStatus.OPENED } } },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    const before = result.current;

    rerender({ quote: { quoteId: QUOTE_ID, quoteStatus: QuoteStatus.OPENED } });

    expect(result.current).toBe(before);
    expect(readContract).toHaveBeenCalledTimes(1);
  });
});
