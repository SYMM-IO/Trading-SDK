import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useQuote } from "./use-quote";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useQuote", () => {
  it("is disabled while `quoteId` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useQuote({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads a single quote by id", async () => {
    const { config, readContract } = createMockSymmioConfig();
    const quote = { id: 42n };
    readContract.mockResolvedValueOnce(quote);

    const { result } = renderHookWithProviders(() => useQuote({ quoteId: 42n, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(quote);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getQuote",
        args: [42n],
      }),
    );
  });

  it("resolves to null for a not-found id", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce({ id: 0n });

    const { result } = renderHookWithProviders(() => useQuote({ quoteId: 999n, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
