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
  it("preserves legacy unwrapped events without synthesizing an envelope", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const onEnvelope = vi.fn();
    const stop = watchNotificationEnvelopes(config, { subscriptions: [{ account: TEST_USER, channel }], onEnvelope });
    fake.last().simulateOpen();
    const frame = { address: TEST_USER, last_seen_action: "SendQuote", quote_id: 4, action_status: "success" };
    fake.last().simulateMessage(frame);
    expect(onEnvelope).toHaveBeenCalledWith(frame);
    fake.last().simulateMessage({ status: "subscribed" });
    expect(onEnvelope).toHaveBeenCalledTimes(1);
    stop();
  });

  it("routes metadata-poor frames only to a subscription covering all matches and isolates callback failures", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const broad = vi.fn();
    const narrow = vi.fn();
    const onError = vi.fn();
    const stopBroad = watchNotificationEnvelopes(config, {
      subscriptions: [
        { account: TEST_USER, channel },
        { account: TEST_USER, channel: "listing" },
      ],
      onEnvelope: broad,
    });
    const stopNarrow = watchNotificationEnvelopes(config, {
      subscriptions: [{ account: TEST_USER, channel }],
      onEnvelope: narrow,
    });
    const stopThrowing = watchNotificationEnvelopes(config, {
      subscriptions: [{ account: TEST_USER, channel }],
      onEnvelope: () => {
        throw new Error("consumer failed");
      },
      onError,
    });
    fake.last().simulateOpen();
    fake.last().simulateMessage({ address: TEST_USER, data: { quote_id: 1 } });
    expect(broad).toHaveBeenCalledTimes(1);
    expect(narrow).not.toHaveBeenCalled();
    fake.last().simulateMessage({ address: TEST_USER, app_name: channel, data: { quote_id: 2 } });
    expect(broad).toHaveBeenCalledTimes(2);
    expect(narrow).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    stopThrowing();
    stopNarrow();
    stopBroad();
  });

  it("shares transport with the position watcher, preserves metadata, and isolates account/channel delivery", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const onEnvelope = vi.fn();
    const onNotification = vi.fn();
    const stopPosition = watchNotifications(config, { account: TEST_USER, onNotification });
    const stopEnvelopes = watchNotificationEnvelopes(config, {
      subscriptions: [
        { account: TEST_USER, channel },
        { account: OTHER, channel: "listing" },
      ],
      onEnvelope,
    });
    expect(fake.instances).toHaveLength(1);
    fake.last().simulateOpen();
    expect(JSON.parse(fake.last().sent[0]!).channel_patterns).toHaveLength(2);
    const envelope = {
      app_name: "listing",
      address: OTHER,
      primary_identifier: 366,
      secondary_identifier: "listing-id",
      type: "report",
      create_time: 1780000000,
      data: { status: "accepted", custom: { preserved: true } },
      extra: "retained",
    };
    fake.last().simulateMessage(envelope);
    expect(onEnvelope).toHaveBeenCalledWith(envelope);
    expect(onNotification).not.toHaveBeenCalled();
    fake
      .last()
      .simulateMessage({ app_name: channel, address: TEST_USER, data: { quote_id: 366, action_status: "success" } });
    expect(onNotification).toHaveBeenCalledTimes(1);
    stopPosition();
    expect(fake.last().closeCalls).toHaveLength(0);
    stopEnvelopes();
    expect(fake.last().closeCalls).toHaveLength(1);
    fake.last().simulateMessage(envelope);
    expect(onEnvelope).toHaveBeenCalledTimes(2);
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
