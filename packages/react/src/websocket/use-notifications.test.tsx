import { act, waitFor } from "@testing-library/react";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useNotifications } from "./use-notifications";

function frame(id: string, quoteId: number, actionStatus: string) {
  return { data: { id, quote_id: quoteId, temp_quote_id: -1, action_status: actionStatus }, address: TEST_EOA };
}

describe("useNotifications", () => {
  it("subscribes, reports open, and buffers notifications newest-first", async () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useNotifications({ account: TEST_EOA, config }));

    await waitFor(() => expect(fake.instances.length).toBe(1));
    act(() => fake.last().simulateOpen());
    await waitFor(() => expect(result.current.status).toBe("open"));

    act(() => fake.last().simulateMessage(frame("n1", 7, "success")));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.latest?.quoteId).toBe("7");

    act(() => fake.last().simulateMessage(frame("n2", 8, "seen")));
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.latest?.quoteId).toBe("8");
  });

  it("stays idle when no account is provided", () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() => useNotifications({ config }));

    expect(fake.instances.length).toBe(0);
    expect(result.current.status).toBe("closed");
  });

  it("surfaces a normalized error for an unsupported chain", async () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });

    const { result } = renderHookWithProviders(() =>
      useNotifications({ account: TEST_EOA, chainId: mainnet.id, config }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.kind).toBe("sdk");
  });
});
