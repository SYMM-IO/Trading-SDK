import { ListingDepositChainId, type GetListingStatusReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getListingStatusQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getListingStatusQueryOptions };
});

import { useListingStatus } from "./use-listing-status";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

/** Only the fields this hook test reads back; the core mapper covers the full shape. */
const STATUS = { currentStep: "deposit" } as unknown as GetListingStatusReturnType;

function mockOptions(queryFn: () => Promise<unknown>) {
  getListingStatusQueryOptions.mockReturnValue({ queryKey: ["getListingStatus", {}], enabled: true, queryFn });
}

describe("useListingStatus", () => {
  afterEach(() => {
    getListingStatusQueryOptions.mockReset();
  });

  it("forwards the market's address pair into the core query options and returns the status", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(STATUS));

    const { result } = renderHookWithProviders(() =>
      useListingStatus({ config, tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.HYPER_EVM }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(STATUS);
    expect(getListingStatusQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.HYPER_EVM,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle until an address is entered, so it can be mounted on an empty form", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(STATUS);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useListingStatus({ config, tokenContractAddress: "", depositChain: ListingDepositChainId.HYPER_EVM }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("fires once the empty address is replaced by a real one", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(STATUS);
    mockOptions(queryFn);

    const { result, rerender } = renderHookWithProviders(
      ({ tokenContractAddress }: { tokenContractAddress: string }) =>
        useListingStatus({ config, tokenContractAddress, depositChain: ListingDepositChainId.HYPER_EVM }),
      { initialProps: { tokenContractAddress: "" } },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

    rerender({ tokenContractAddress: TOKEN });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).toHaveBeenCalled();
  });

  it("stays idle on an explicit query.enabled = false even with a valid address", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(STATUS);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useListingStatus({
        config,
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.HYPER_EVM,
        query: { enabled: false },
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      useListingStatus({ config, tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.HYPER_EVM }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
