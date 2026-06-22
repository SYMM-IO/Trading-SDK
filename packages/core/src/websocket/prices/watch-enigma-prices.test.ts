import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { mockConfig } from "../../shared/test/mock-config";
import type { SocketStatus } from "../socket/socket-status";
import { watchEnigmaPrices } from "./watch-enigma-prices";
import type { EnigmaPriceTick } from "./types";

describe("watchEnigmaPrices", () => {
  it("opens the price socket and delivers normalized ticks", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const received: EnigmaPriceTick[][] = [];
    const statuses: SocketStatus[] = [];

    const unwatch = watchEnigmaPrices(config, {
      onPrices: (ticks) => received.push(ticks),
      onStatusChange: (s) => statuses.push(s),
    });

    fake.last().simulateOpen();
    expect(statuses).toContain("open");

    fake.last().simulateMessage([
      { name: "BTCUSDT", markPrice: 65000.1 },
      { name: "ETHUSDT", markPrice: 3200.5 },
    ]);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([
      { name: "BTCUSDT", markPrice: "65000.1" },
      { name: "ETHUSDT", markPrice: "3200.5" },
    ]);

    unwatch();
  });

  it("ignores non-array control frames", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    const received: EnigmaPriceTick[][] = [];

    watchEnigmaPrices(config, { onPrices: (ticks) => received.push(ticks) });
    fake.last().simulateOpen();

    fake.last().simulateMessage({ pong: 1 });
    expect(received).toHaveLength(0);
  });

  it("throws synchronously for an unsupported chain", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });
    expect(() => watchEnigmaPrices(config, { chainId: mainnet.id, onPrices: () => {} })).toThrow(SymmError);
  });

  it("shares one socket between watchers", () => {
    const fake = createFakeWebSocket();
    const { config } = mockConfig({ webSocketConstructor: fake.WebSocket });

    const u1 = watchEnigmaPrices(config, { onPrices: () => {} });
    const u2 = watchEnigmaPrices(config, { onPrices: () => {} });

    expect(fake.instances.length).toBe(1);
    u1();
    u2();
  });
});
