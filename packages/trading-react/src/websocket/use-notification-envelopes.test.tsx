import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useNotificationEnvelopes } from "./use-notification-envelopes";

describe("useNotificationEnvelopes", () => {
  it("keeps one connection across callback changes and cleans up on unmount", async () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });
    let callback = vi.fn();
    const { result, rerender, unmount } = renderHookWithProviders(() =>
      useNotificationEnvelopes({
        config,
        chainId: 42161,
        subscriptions: [{ account: TEST_EOA, channel: "listing" }],
        onEnvelope: callback,
      }),
    );
    await waitFor(() => expect(fake.instances).toHaveLength(1));
    act(() => fake.last().simulateOpen());
    expect(result.current.status).toBe("open");
    callback = vi.fn();
    rerender();
    expect(fake.instances).toHaveLength(1);
    const envelope = { app_name: "listing", address: TEST_EOA, primary_identifier: 1, data: { status: "accepted" } };
    act(() => fake.last().simulateMessage(envelope));
    expect(callback).toHaveBeenCalledWith(envelope);
    unmount();
    expect(fake.last().readyState).toBe(3);
  });

  it("does not connect while disabled or subscriptions are empty", () => {
    const fake = createFakeWebSocket();
    const { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });
    const { result } = renderHookWithProviders(() =>
      useNotificationEnvelopes({ config, subscriptions: [], onEnvelope: vi.fn() }),
    );
    expect(fake.instances).toHaveLength(0);
    expect(result.current.status).toBe("closed");
  });
});
