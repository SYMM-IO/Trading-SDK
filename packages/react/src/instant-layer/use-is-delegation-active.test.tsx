import { waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useIsDelegationActive } from "./use-is-delegation-active";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("useIsDelegationActive", () => {
  it("reads delegation active status and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(true);

    const { result } = renderHookWithProviders(() =>
      useIsDelegationActive({ account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.instantLayerAddress,
        functionName: "isDelegationActive",
        args: [ACCOUNT, DELEGATE, SELECTOR],
      }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() =>
      useIsDelegationActive({ account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR, config }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
