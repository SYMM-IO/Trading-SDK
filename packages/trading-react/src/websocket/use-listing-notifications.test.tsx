import { act, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createFakeWebSocket, createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useListingNotifications } from "./use-listing-notifications";

it("delivers typed listing events only during the enabled subscription", async () => {
  const fake = createFakeWebSocket(),
    { config } = createMockSymmioConfig({ webSocketConstructor: fake.WebSocket });
  let enabled = false;
  const onNotification = vi.fn();
  const { rerender } = renderHookWithProviders(() =>
    useListingNotifications({
      config,
      enabled,
      subscriptions: [{ account: TEST_EOA, channel: "listing" }],
      onNotification,
    }),
  );
  expect(fake.instances).toHaveLength(0);
  enabled = true;
  rerender();
  await waitFor(() => expect(fake.instances).toHaveLength(1));
  const socket = fake.last();
  const frame = {
    address: TEST_EOA,
    app_name: "listing",
    data: { details: { event: "pool_created", token_ticker: "MAD" }, market_id: 42 },
  };
  act(() => {
    socket.simulateOpen();
    socket.simulateMessage(frame);
  });
  expect(onNotification).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "pool_created", account: TEST_EOA, marketId: "42", tokenTicker: "MAD" }),
  );
  enabled = false;
  rerender();
  act(() => socket.simulateMessage(frame));
  expect(onNotification).toHaveBeenCalledTimes(1);
});
