import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useCoolDownsOfMA } from "./use-cool-downs-of-ma";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useCoolDownsOfMA", () => {
  it("reads the cooldown tuple; index 1 is the force-cancel cooldown", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([10n, 300n, 600n, 900n]);

    const { result } = renderHookWithProviders(() => useCoolDownsOfMA({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([10n, 300n, 600n, 900n]);
    expect(result.current.data?.[1]).toBe(300n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "coolDownsOfMA",
      }),
    );
  });
});
