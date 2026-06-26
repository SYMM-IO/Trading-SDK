import { waitFor } from "@testing-library/react";
import { getChainConfig, SymmioSupportedChainId, VIRTUAL_ACCOUNT_ISOLATION_TYPE } from "@theoldvarorg/core";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useVirtualAccount } from "./use-virtual-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VA: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PARENT: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const DETAIL = {
  accountAddress: VA,
  parentAccount: PARENT,
  symbolId: 1n,
  isExists: true,
  metadata: "0x" as Hex,
  isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
};

describe("useVirtualAccount", () => {
  it("is disabled while `account` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useVirtualAccount({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the VA detail with `getVirtualAccount` and maps the struct", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(DETAIL);

    const { result } = renderHookWithProviders(() => useVirtualAccount({ account: VA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccount",
        args: [VA],
      }),
    );
    expect(result.current.data).toEqual(DETAIL);
  });

  it("normalizes a read failure into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useVirtualAccount({ account: VA, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as SymmioRequestError).kind).toBe("unknown");
  });
});
