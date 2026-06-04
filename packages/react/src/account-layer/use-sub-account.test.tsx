import { SubAccountIsolationType, type SubAccountDetail } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useSubAccount } from "./use-sub-account";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const SAMPLE: SubAccountDetail = {
  owner: TEST_EOA,
  name: "First",
  metadata: "0x",
  isExists: true,
  singleVAMode: false,
  isolationType: SubAccountIsolationType.POSITION,
  affiliate: "0x0000000000000000000000000000000000000000",
  symmioCore: "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
  accountAddress: SUB_ACCOUNT,
};

describe("useSubAccount", () => {
  it("is disabled while `account` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSubAccount({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("pending");
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the subaccount and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(SAMPLE);

    const { result } = renderHookWithProviders(() => useSubAccount({ account: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SAMPLE);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getSubAccount", args: [SUB_ACCOUNT] }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useSubAccount({ account: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
