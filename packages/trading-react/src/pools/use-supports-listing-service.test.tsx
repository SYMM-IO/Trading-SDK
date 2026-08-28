import { SymmioSupportedChainId } from "@symmio/trading-core";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSupportsListingService } from "./use-supports-listing-service";

describe("useSupportsListingService", () => {
  it("reports true on the connected chain when it carries a listing block", () => {
    const { config } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() => useSupportsListingService({ config }));

    expect(result.current).toBe(true);
  });

  it("reports false for a chain with no listing backend, instead of throwing", () => {
    const { config } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      useSupportsListingService({ config, chainId: SymmioSupportedChainId.BASE }),
    );

    expect(result.current).toBe(false);
  });

  it("reports false for a chain the SDK does not support at all", () => {
    const { config } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() => useSupportsListingService({ config, chainId: mainnet.id }));

    expect(result.current).toBe(false);
  });
});
