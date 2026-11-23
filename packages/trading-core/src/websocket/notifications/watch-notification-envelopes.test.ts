import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import { watchNotificationEnvelopes } from "./watch-notification-envelopes";
import { watchNotifications } from "./watch-notifications";

const OTHER = "0x2222222222222222222222222222222222222222" as const;
const notifications = getChainConfig(SymmioSupportedChainId.ARBITRUM).solvers.enigma!.notifications;
const channel = notifications.protocol === "enigma" ? notifications.channel : "";

afterEach(() => vi.useRealTimers());

describe("watchNotificationEnvelopes", () => {
  it("keeps normalized position delivery scoped through listing subscription, removal and reconnect", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const onNotification = vi.fn(),
      onEnvelope = vi.fn(),
      onError = vi.fn();
    const stop = watchNotifications(config, { account: TEST_USER, onNotification });
    const position = fake.last();
    position.simulateOpen();
    const frame = {
      address: TEST_USER,
      data: { quote_id: 7, last_seen_action: "SendQuote", action_status: "success" },
    };
    position.simulateMessage(frame);
    const release = watchNotificationEnvelopes(config, {
      subscriptions: [{ account: TEST_USER, channel: "listing" }],
      onEnvelope,
      onError,
    });
    const listing = fake.last();
    listing.simulateOpen();
    position.simulateMessage(frame);
    listing.simulateMessage(frame);
    expect(onError).toHaveBeenCalledTimes(1);
    listing.simulateMessage({ ...frame, app_name: channel });
    expect(onEnvelope).not.toHaveBeenCalled();
    const listed = { ...frame, app_name: "listing", primary_identifier: 42 };
    listing.simulateMessage(listed);
    expect(onEnvelope).toHaveBeenCalledWith(listed);
    release();
    position.simulateMessage(frame);
    position.simulateClose();
    vi.advanceTimersByTime(11000);
    fake.last().simulateOpen();
    fake.last().simulateMessage(frame);
    expect(onNotification).toHaveBeenCalledTimes(4);
    stop();
  });

  it("resubscribes only the active union after reconnect and ignores removed subscribers", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = watchNotificationEnvelopes(config, {
      subscriptions: [{ account: TEST_USER, channel }],
      onEnvelope: first,
    });
    const stopSecond = watchNotificationEnvelopes(config, {
      subscriptions: [{ account: OTHER, channel }],
      onEnvelope: second,
    });
    fake.last().simulateOpen();
    stopFirst();
    stopFirst();
    fake.last().simulateClose();
    vi.advanceTimersByTime(11000);
    fake.last().simulateOpen();
    expect(JSON.parse(fake.last().sent[0]!).channel_patterns).toEqual([
      { app_name: channel, address: OTHER, primary_identifier: "*", secondary_identifier: "*" },
    ]);
    fake.last().simulateMessage({ app_name: channel, address: TEST_USER, data: {} });
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    stopSecond();
  });

  it("does not open a socket for an empty subscription and isolates config instances", () => {
    const fake = createFakeWebSocket();
    const one = mockConfig({ webSocketConstructor: fake.WebSocket }).config;
    const two = mockConfig({ webSocketConstructor: fake.WebSocket }).config;
    watchNotificationEnvelopes(one, { subscriptions: [], onEnvelope: vi.fn() })();
    expect(fake.instances).toHaveLength(0);
    const params = { subscriptions: [{ account: TEST_USER, channel }], onEnvelope: vi.fn() };
    const stopOne = watchNotificationEnvelopes(one, params);
    const stopTwo = watchNotificationEnvelopes(two, params);
    expect(fake.instances).toHaveLength(2);
    stopOne();
    stopTwo();
  });
});
