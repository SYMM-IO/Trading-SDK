import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useGeneratedAccountManagerAddress } from "./use-generated-account-manager-address";

const REGISTRANT: Address = "0x1111111111111111111111111111111111111111";
const PREDICTED: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";

describe("useGeneratedAccountManagerAddress", () => {
  it("is disabled until both `registrant` and `name` are set and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useGeneratedAccountManagerAddress({ registrant: REGISTRANT, config }),
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("pending");
    expect(readContract).not.toHaveBeenCalled();
  });

  it("predicts the affiliate address and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(PREDICTED);

    const { result } = renderHookWithProviders(() =>
      useGeneratedAccountManagerAddress({ registrant: REGISTRANT, name: "Acme", config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(PREDICTED);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "generateAccountManagerAddress", args: [REGISTRANT, "Acme"] }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() =>
      useGeneratedAccountManagerAddress({ registrant: REGISTRANT, name: "Acme", config }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
