import { describe, expect, it } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { usePriceByMarketId } from "./use-price-by-market-id";

describe("usePriceByMarketId", () => {
  it("stays idle while markets have not resolved", () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => usePriceByMarketId({ config, marketId: 1 }));

    expect(result.current.markPrice).toBeNull();
    expect(result.current.marketName).toBeNull();
    expect(result.current.tick).toBeNull();
    // useMarkets has not produced data in tests → name unresolved → no subscribe.
    expect(fake.instances.length).toBe(0);
  });
});
