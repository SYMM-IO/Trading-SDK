import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeWebSocket } from "../../../shared/test/fake-web-socket";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { acquireRasaNotificationsSocket, buildRasaSubscribeMessage } from "./rasa-notifications-hub";

const URL = "wss://rasa.test/ws/position-state";
const OTHER_USER: Address = "0x2222222222222222222222222222222222222222";

describe("buildRasaSubscribeMessage", () => {
  it("serializes the full address list", () => {
    expect(buildRasaSubscribeMessage([TEST_USER, OTHER_USER])).toBe(
      JSON.stringify({ address: [TEST_USER, OTHER_USER] }),
    );
  });
});

describe("acquireRasaNotificationsSocket", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens one socket per URL and subscribes with every watched address on open", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });

    const r1 = acquireRasaNotificationsSocket(config, { url: URL, account: TEST_USER, listener: {} });
    const r2 = acquireRasaNotificationsSocket(config, { url: URL, account: OTHER_USER, listener: {} });

    expect(fake.instances.length).toBe(1);
    fake.last().simulateOpen();
    expect(JSON.parse(fake.last().sent[0]!)).toEqual({ address: [TEST_USER, OTHER_USER] });

    r1();
    r2();
  });

  it("re-sends the grown list when a new address joins an open socket", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });

    const r1 = acquireRasaNotificationsSocket(config, { url: URL, account: TEST_USER, listener: {} });
    fake.last().simulateOpen();
    expect(fake.last().sent).toHaveLength(1);

    const r2 = acquireRasaNotificationsSocket(config, { url: URL, account: OTHER_USER, listener: {} });
    expect(JSON.parse(fake.last().sent[1]!)).toEqual({ address: [TEST_USER, OTHER_USER] });

    // A second watcher of an already-watched address does not re-send.
    const r3 = acquireRasaNotificationsSocket(config, { url: URL, account: OTHER_USER, listener: {} });
    expect(fake.last().sent).toHaveLength(2);

    r1();
    r2();
    r3();
  });

  it("re-sends the shrunk list when an address's last watcher releases", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });

    const r1 = acquireRasaNotificationsSocket(config, { url: URL, account: TEST_USER, listener: {} });
    const r2 = acquireRasaNotificationsSocket(config, { url: URL, account: OTHER_USER, listener: {} });
    fake.last().simulateOpen();

    r2();
    expect(JSON.parse(fake.last().sent.at(-1)!)).toEqual({ address: [TEST_USER] });

    r1();
  });

  it("re-subscribes with the current list after a reconnect", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });

    const r1 = acquireRasaNotificationsSocket(config, { url: URL, account: TEST_USER, listener: {} });
    fake.last().simulateOpen();
    const r2 = acquireRasaNotificationsSocket(config, { url: URL, account: OTHER_USER, listener: {} });

    fake.last().simulateClose(1006);
    vi.advanceTimersByTime(10_000); // past any jittered backoff → re-dial

    expect(fake.instances.length).toBe(2);
    fake.last().simulateOpen();
    // The open-message factory reads the live set: both addresses, one frame.
    expect(JSON.parse(fake.last().sent[0]!)).toEqual({ address: [TEST_USER, OTHER_USER] });

    r1();
    r2();
  });

  it("fans out frames and closes the socket when the last watcher releases", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const seenByFirst: unknown[] = [];
    const seenBySecond: unknown[] = [];

    const r1 = acquireRasaNotificationsSocket(config, {
      url: URL,
      account: TEST_USER,
      listener: { onMessage: (d) => seenByFirst.push(d) },
    });
    const r2 = acquireRasaNotificationsSocket(config, {
      url: URL,
      account: OTHER_USER,
      listener: { onMessage: (d) => seenBySecond.push(d) },
    });
    fake.last().simulateOpen();

    fake.last().simulateMessage({ quote_id: 1 });
    // The hub does not filter — every listener sees every frame.
    expect(seenByFirst).toHaveLength(1);
    expect(seenBySecond).toHaveLength(1);

    r1();
    const socket = fake.last();
    r2();
    expect(socket.readyState).not.toBe(1);

    // A fresh acquire after teardown dials a new socket (the hub was deleted).
    const r3 = acquireRasaNotificationsSocket(config, { url: URL, account: TEST_USER, listener: {} });
    expect(fake.instances.length).toBe(2);
    r3();
  });
});
