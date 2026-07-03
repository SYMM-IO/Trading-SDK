import { type GetInstantClosesReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getInstantClosesQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getInstantClosesQueryOptions };
});

import { useInstantCloses } from "./use-instant-closes";

const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const RESULT: GetInstantClosesReturnType = [
  {
    quoteId: 42n,
    quantityToClose: 10n ** 18n,
    closePrice: 50_000n * 10n ** 18n,
  },
];

describe("useInstantCloses", () => {
  afterEach(() => {
    getInstantClosesQueryOptions.mockReset();
  });

  it("wires partyA + connected chain into the core query options and returns the data", async () => {
    const { config } = createMockSymmioConfig();
    getInstantClosesQueryOptions.mockReturnValue({
      queryKey: ["getInstantCloses", { partyA: PARTY_A }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() => useInstantCloses({ partyA: PARTY_A, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getInstantClosesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ partyA: PARTY_A, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getInstantClosesQueryOptions.mockReturnValue({
      queryKey: ["getInstantCloses", { partyA: PARTY_A }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("hedger down")),
    });

    const { result } = renderHookWithProviders(() => useInstantCloses({ partyA: PARTY_A, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
