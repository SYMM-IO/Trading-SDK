import { describe, expect, it } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useEnigmaPriceByMarketId } from "./use-enigma-price-by-market-id";

describe("useEnigmaPriceByMarketId", () => {
  it("stays idle while markets have not resolved", () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useEnigmaPriceByMarketId({ config, marketId: 1 }));

    expect(result.current.markPrice).toBeNull();
    expect(result.current.marketName).toBeNull();
    // useMarkets has not produced data in tests → name unresolved → no subscribe.
    expect(fake.instances.length).toBe(0);
  });
});
