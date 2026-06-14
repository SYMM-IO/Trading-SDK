import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import type { SocketStatus } from "../socket/socket-status";
import type { Notification } from "./types";
import { watchNotifications } from "./watch-notifications";

const CHANNEL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).notifications.channel;

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
