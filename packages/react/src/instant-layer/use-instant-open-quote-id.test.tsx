import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getInstantOpenQuoteIdQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getInstantOpenQuoteIdQueryOptions };
});

import { useInstantOpenQuoteId } from "./use-instant-open-quote-id";

describe("useInstantOpenQuoteId", () => {
  afterEach(() => {
    getInstantOpenQuoteIdQueryOptions.mockReset();
  });

  it("wires tempQuoteId into the core query options and returns the on-chain id", async () => {
    const { config } = createMockSymmioConfig();
    getInstantOpenQuoteIdQueryOptions.mockReturnValue({
      queryKey: ["getInstantOpenQuoteId", { tempQuoteId: -1001 }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(4567),
    });

    const { result } = renderHookWithProviders(() => useInstantOpenQuoteId({ tempQuoteId: -1001, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(4567);
    expect(getInstantOpenQuoteIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ tempQuoteId: -1001 }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getInstantOpenQuoteIdQueryOptions.mockReturnValue({
      queryKey: ["getInstantOpenQuoteId", { tempQuoteId: -1001 }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("hedger down")),
    });

    const { result } = renderHookWithProviders(() => useInstantOpenQuoteId({ tempQuoteId: -1001, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
