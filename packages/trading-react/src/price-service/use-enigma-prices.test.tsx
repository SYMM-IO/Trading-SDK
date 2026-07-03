import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useEnigmaPrices } from "./use-enigma-prices";

describe("useEnigmaPrices", () => {
  it("subscribes, reports open, and accumulates prices by name", async () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useEnigmaPrices({ config }));

    await waitFor(() => expect(fake.instances.length).toBe(1));
    act(() => fake.last().simulateOpen());
    await waitFor(() => expect(result.current.status).toBe("open"));

    act(() =>
      fake.last().simulateMessage([
        { name: "BTCUSDT", markPrice: 65000.1 },
        { name: "ETHUSDT", markPrice: 3200 },
      ]),
    );
    await waitFor(() => expect(result.current.prices.BTCUSDT).toBe("65000.1"));
    expect(result.current.prices.ETHUSDT).toBe("3200");

    act(() => fake.last().simulateMessage([{ name: "BTCUSDT", markPrice: 65100 }]));
    await waitFor(() => expect(result.current.prices.BTCUSDT).toBe("65100"));
    expect(result.current.prices.ETHUSDT).toBe("3200");
  });

  it("stays closed when disabled", () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useEnigmaPrices({ config, enabled: false }));

    expect(fake.instances.length).toBe(0);
    expect(result.current.status).toBe("closed");
  });
});
