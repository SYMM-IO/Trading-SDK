import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import type { SocketStatus } from "../socket/socket-status";
import type { Notification } from "./types";
import { watchNotifications } from "./watch-notifications";

const HYPER_EVM_NOTIFICATIONS = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solvers.enigma!.notifications;
const CHANNEL = HYPER_EVM_NOTIFICATIONS.protocol === "enigma" ? HYPER_EVM_NOTIFICATIONS.channel : "";

describe("watchNotifications", () => {
  it("subscribes on open and delivers normalized notifications + status", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const received: Notification[] = [];
    const statuses: SocketStatus[] = [];

    const unwatch = watchNotifications(config, {
      account: TEST_USER,
      onNotification: (n) => received.push(n),
      onStatusChange: (s) => statuses.push(s),
    });

    fake.last().simulateOpen();

    const subscribe = JSON.parse(fake.last().sent[0]!);
    expect(subscribe.channel_patterns[0].app_name).toBe(CHANNEL);
    expect(subscribe.channel_patterns[0].address).toBe(TEST_USER);

    fake.last().simulateMessage({
      data: { id: "n1", quote_id: 7, temp_quote_id: -1, action_status: "success" },
      address: TEST_USER,
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.quoteId).toBe("7");
    expect(statuses).toContain("open");

    unwatch();
  });

  it("throws synchronously for an unsupported chain", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    expect(() =>
      watchNotifications(config, { account: TEST_USER, chainId: mainnet.id, onNotification: () => {} }),
    ).toThrow(SymmError);
  });

  it("throws when no WebSocket implementation is available", () => {
    const { config } = mockConfig(); // no webSocketConstructor injected
    const original = (globalThis as { WebSocket?: unknown }).WebSocket;
    (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
    try {
      expect(() => watchNotifications(config, { account: TEST_USER, onNotification: () => {} })).toThrow(SymmError);
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = original;
    }
  });

  it("shares one socket between watchers for the same account", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });

    const u1 = watchNotifications(config, { account: TEST_USER, onNotification: () => {} });
    const u2 = watchNotifications(config, { account: TEST_USER, onNotification: () => {} });

    expect(fake.instances.length).toBe(1);
    u1();
    u2();
  });
});

const OTHER_USER = "0x2222222222222222222222222222222222222222" as const;

/** A rasa open-flow report frame, as captured from the live endpoint. */
function rasaOpenReportFrame(counterparty: string) {
  return {
    id: "d6fade8c-458e-462d-8450-59107e489e2f",
    create_time: 1785910037,
    modify_time: 1785910037,
    quote_id: -712,
    temp_quote_id: -712,
    counterparty_address: counterparty,
    state_type: "report",
    filled_amount_open: "8.500000000000000000",
    filled_amount_close: 0,
    avg_price_open: "1.0684",
    avg_price_close: 0,
    last_seen_action: "InstantRFQ",
    action_status: "success",
    failure_type: null,
    error_code: 0,
    order_type: 1,
  };
}

describe("watchNotifications — rasa protocol (Base)", () => {
  const BASE = SymmioSupportedChainId.BASE;

  it("subscribes with the address-list frame and normalizes rasa frames", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const received: Notification[] = [];

    const unwatch = watchNotifications(config, {
      account: TEST_USER,
      chainId: BASE,
      onNotification: (n) => received.push(n),
    });

    fake.last().simulateOpen();
    expect(JSON.parse(fake.last().sent[0]!)).toEqual({ address: [TEST_USER] });

    fake.last().simulateMessage(rasaOpenReportFrame(TEST_USER));

    expect(received).toHaveLength(1);
    const n = received[0]!;
    // Pre-anchor: quote_id equals the negative temp id, so quoteId falls back to it.
    expect(n.quoteId).toBe("-712");
    expect(n.tempQuoteId).toBe(-712);
    // The wire has no `address`; the watcher stamps the subscribed account.
    expect(n.account).toBe(TEST_USER);
    expect(n.vaAddress).toBeNull();
    expect(n.lastSeenAction).toBe("InstantRFQ");
    expect(n.stateType).toBe("report");
    expect(n.filledAmountOpen).toBe("8.500000000000000000");
    expect(n.avgPriceOpen).toBe("1.0684");
    // Numeric zero-sentinels normalize to "no value".
    expect(n.filledAmountClose).toBeNull();
    expect(n.avgPriceClose).toBe("");

    unwatch();
  });

  it("resolves quoteId to the on-chain id once the anchor frame carries it", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const received: Notification[] = [];

    const unwatch = watchNotifications(config, {
      account: TEST_USER,
      chainId: BASE,
      onNotification: (n) => received.push(n),
    });
    fake.last().simulateOpen();

    fake.last().simulateMessage({
      ...rasaOpenReportFrame(TEST_USER),
      quote_id: 228235,
      state_type: "alert",
      filled_amount_open: 0,
      avg_price_open: 0,
      last_seen_action: "SendQuoteTransaction",
    });

    expect(received[0]?.quoteId).toBe("228235");
    expect(received[0]?.tempQuoteId).toBe(-712);
    expect(received[0]?.avgPriceOpen).toBe("");

    unwatch();
  });

  it("multiplexes accounts on one socket and filters frames per watcher", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const forFirst: Notification[] = [];
    const forSecond: Notification[] = [];

    const u1 = watchNotifications(config, {
      account: TEST_USER,
      chainId: BASE,
      onNotification: (n) => forFirst.push(n),
    });
    fake.last().simulateOpen();
    const u2 = watchNotifications(config, {
      account: OTHER_USER,
      chainId: BASE,
      onNotification: (n) => forSecond.push(n),
    });

    // One shared socket; joining after open re-sends the grown address list.
    expect(fake.instances.length).toBe(1);
    expect(JSON.parse(fake.last().sent.at(-1)!)).toEqual({ address: [TEST_USER, OTHER_USER] });

    fake.last().simulateMessage(rasaOpenReportFrame(OTHER_USER));
    expect(forFirst).toHaveLength(0);
    expect(forSecond).toHaveLength(1);
    expect(forSecond[0]?.account).toBe(OTHER_USER);

    u1();
    u2();
  });
});
