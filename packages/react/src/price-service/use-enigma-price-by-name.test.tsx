import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useEnigmaPriceByName } from "./use-enigma-price-by-name";

describe("useEnigmaPriceByName", () => {
  it("stays closed when disabled", () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useEnigmaPriceByName({ config, name: "BTCUSDT", enabled: false }));

    expect(fake.instances.length).toBe(0);
    expect(result.current.markPrice).toBeNull();
    expect(result.current.status).toBe("closed");
  });

  it("updates only when the watched symbol's price changes", async () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useEnigmaPriceByName({ config, name: "BTCUSDT" }));

    await waitFor(() => expect(fake.instances.length).toBe(1));
    act(() => fake.last().simulateOpen());

    // First matching tick — populates markPrice.
    act(() =>
      fake.last().simulateMessage([
        { name: "ETHUSDT", markPrice: 3200 },
        { name: "BTCUSDT", markPrice: 65000.1 },
      ]),
    );
    await waitFor(() => expect(result.current.markPrice).toBe("65000.1"));

    // Tick without the watched symbol — markPrice stays.
    act(() => fake.last().simulateMessage([{ name: "ETHUSDT", markPrice: 3201 }]));
    expect(result.current.markPrice).toBe("65000.1");

    // Same matching price — reference is preserved (setState bail-out).
    const ref = result.current;
    act(() => fake.last().simulateMessage([{ name: "BTCUSDT", markPrice: 65000.1 }]));
    expect(result.current.markPrice).toBe("65000.1");
    expect(result.current).toBe(ref);

    // Real change updates.
    act(() => fake.last().simulateMessage([{ name: "BTCUSDT", markPrice: 65100 }]));
    await waitFor(() => expect(result.current.markPrice).toBe("65100"));
  });
});
