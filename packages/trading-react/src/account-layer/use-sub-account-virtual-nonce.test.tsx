import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSubAccountVirtualNonce } from "./use-sub-account-virtual-nonce";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useSubAccountVirtualNonce", () => {
  it("is disabled while `subAccount` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSubAccountVirtualNonce({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the VA nonce for the subaccount and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(7n);

    const { result } = renderHookWithProviders(() => useSubAccountVirtualNonce({ subAccount: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getSubAccountVirtualNonce", args: [SUB_ACCOUNT] }),
    );
  });
});
