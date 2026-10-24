import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getLiquidationDetailsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getLiquidationDetailsQueryOptions };
});

import { useLiquidationDetails } from "./use-liquidation-details";

const RESULT = { rows: [], hasMore: false };

describe("useLiquidationDetails", () => {
  afterEach(() => {
    getLiquidationDetailsQueryOptions.mockReset();
  });

  it("wires the filters and the connected chain into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    getLiquidationDetailsQueryOptions.mockReturnValue({
      queryKey: ["getLiquidationDetails", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() =>
      useLiquidationDetails({ ...{ partyAs: ["0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A"] }, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getLiquidationDetailsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        ...{ partyAs: ["0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A"] },
        chainId: expect.any(Number),
      }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getLiquidationDetailsQueryOptions.mockReturnValue({
      queryKey: ["getLiquidationDetails", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useLiquidationDetails({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
