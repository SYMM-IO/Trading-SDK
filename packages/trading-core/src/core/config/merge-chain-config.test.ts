import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig as getBuiltInChainConfig } from "../chains/actions/get-chain-config";
import { SymmioSupportedChainId } from "../chains/supported-chains";
import { createConfig } from "./create-config";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const CHAIN = SymmioSupportedChainId.HYPER_EVM;

function build(priceService: Record<string, unknown>) {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: AFFILIATE }, priceService } },
  });
}

describe("mergeChainConfig — priceService", () => {
  it("inherits the built-in block when no override is supplied", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: AFFILIATE } } },
    });

    expect(config.getChainConfig(CHAIN).priceService).toEqual(getBuiltInChainConfig(CHAIN).priceService);
  });

  /**
   * The shape `apps/web` already uses for its staging override: both URLs, no
   * `type`. It must keep merging field-by-field.
   */
  it("merges a same-provider override without requiring `type`", () => {
    const config = build({ url: "https://staging.test", wsUrl: "wss://staging.test/ws" });

    expect(config.getChainConfig(CHAIN).priceService).toEqual({
      type: "enigma",
      url: "https://staging.test",
      wsUrl: "wss://staging.test/ws",
    });
  });

  it("merges a single field when the override restates the same `type`", () => {
    const config = build({ type: "enigma", url: "https://only-rest.test" });
    const { priceService } = config.getChainConfig(CHAIN);

    expect(priceService.url).toBe("https://only-rest.test");
    expect(priceService.wsUrl).toBe(getBuiltInChainConfig(CHAIN).priceService.wsUrl);
  });

  it("replaces the block wholesale when a provider swap supplies both URLs", () => {
    const config = build({
      type: "binance",
      url: "https://fapi.binance.com",
      wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
    });

    expect(config.getChainConfig(CHAIN).priceService).toEqual({
      type: "binance",
      url: "https://fapi.binance.com",
      wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
    });
  });

  /**
   * The bug the widening would otherwise introduce: a bare `{ type }` swap
   * inherits the previous provider's URLs, pointing one provider's client at
   * another's host — type-checked green, 404 at runtime.
   */
  it("throws when a provider swap omits the URLs", () => {
    expect(() => build({ type: "binance" })).toThrow(/PRICE_SERVICE_OVERRIDE_INCOMPLETE|changes type/i);
  });

  it("throws when a provider swap supplies only one URL", () => {
    expect(() => build({ type: "binance", url: "https://fapi.binance.com" })).toThrow(/wsUrl/);
  });

  it("rejects a price-service type the SDK has no client for", () => {
    expect(() => build({ type: "bogus", url: "https://x.test", wsUrl: "wss://x.test" })).toThrow(/not supported/i);
  });
});

describe("mergeChainConfig — per-solver priceService override", () => {
  const base = {
    addresses: { affiliatesAddress: AFFILIATE },
    defaultSolverId: "enigma",
    solvers: {
      enigma: {
        name: "Enigma",
        address: AFFILIATE,
        url: "https://enigma.test",
        notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
      },
      rasa: {
        name: "Rasa",
        address: AFFILIATE,
        url: "https://rasa.test",
        notifications: { url: "wss://rasa.test/ws", protocol: "rasa" },
      },
    },
  } as const;

  function buildWithSolvers(rasaPriceService?: Record<string, unknown>) {
    return createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [CHAIN]: {
          ...base,
          solvers: {
            ...base.solvers,
            rasa: { ...base.solvers.rasa, ...(rasaPriceService ? { priceService: rasaPriceService } : {}) },
          },
        },
      },
    });
  }

  it("leaves priceService absent when the solver does not declare one", () => {
    const solver = buildWithSolvers().getSolver({ chainId: CHAIN, solverId: "rasa" });

    expect(solver.priceService).toBeUndefined();
  });

  it("keeps a complete solver-nested block", () => {
    const solver = buildWithSolvers({
      type: "binance",
      url: "https://fapi.binance.com",
      wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
    }).getSolver({ chainId: CHAIN, solverId: "rasa" });

    expect(solver.priceService?.type).toBe("binance");
  });

  /** There is no per-solver base to inherit from, so a partial block is a config error. */
  it("throws on a partial solver-nested block", () => {
    expect(() => buildWithSolvers({ type: "binance" })).toThrow(/must declare/i);
  });

  it("rejects an unsupported type in a solver-nested block", () => {
    expect(() => buildWithSolvers({ type: "bogus", url: "https://x.test", wsUrl: "wss://x.test" })).toThrow(
      /not supported/i,
    );
  });
});

describe("mergeChainConfig — notifications (per-solver)", () => {
  const BASE_CHAIN = SymmioSupportedChainId.BASE;

  function buildNotifications(chainId: number, solverId: "enigma" | "rasa", notifications: Record<string, unknown>) {
    return createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [chainId]: { addresses: { affiliatesAddress: AFFILIATE }, solvers: { [solverId]: { notifications } } },
      },
    });
  }

  it("merges a same-protocol override field-by-field", () => {
    const config = buildNotifications(CHAIN, "enigma", { url: "wss://staging.test/ws" });
    const { notifications } = config.getSolver({ chainId: CHAIN, solverId: "enigma" });

    expect(notifications.url).toBe("wss://staging.test/ws");
    expect(notifications.protocol).toBe("enigma");
    expect(notifications.protocol === "enigma" && notifications.channel).toBe(
      (() => {
        const built = getBuiltInChainConfig(CHAIN).solvers.enigma!.notifications;
        return built.protocol === "enigma" ? built.channel : "";
      })(),
    );
  });

  /** Same trap as priceService: a bare protocol swap would inherit the previous protocol's endpoint. */
  it("throws when a protocol swap omits the url", () => {
    expect(() => buildNotifications(CHAIN, "enigma", { protocol: "rasa" })).toThrow(
      /NOTIFICATIONS_OVERRIDE_INCOMPLETE|url/,
    );
  });

  it("throws when a swap to enigma omits the channel", () => {
    expect(() => buildNotifications(BASE_CHAIN, "rasa", { protocol: "enigma", url: "wss://x.test" })).toThrow(
      /channel/,
    );
  });

  /** A swap takes the override block alone — no stale `channel`, no stale `searchUrl`. */
  it("drops every stale enigma field when swapping to rasa", () => {
    const config = buildNotifications(CHAIN, "enigma", { protocol: "rasa", url: "wss://rasa.test/ws" });
    const { notifications } = config.getSolver({ chainId: CHAIN, solverId: "enigma" });

    expect(notifications).toEqual({ protocol: "rasa", url: "wss://rasa.test/ws" });
  });

  it("accepts a complete swap to enigma", () => {
    const config = buildNotifications(BASE_CHAIN, "rasa", {
      protocol: "enigma",
      url: "wss://notification.test/ws/v1/subscribe",
      channel: "Base_Solver_Production",
    });
    const { notifications } = config.getSolver({ chainId: BASE_CHAIN, solverId: "rasa" });

    expect(notifications.protocol).toBe("enigma");
    expect(notifications.protocol === "enigma" && notifications.channel).toBe("Base_Solver_Production");
  });
});

describe("mergeChainConfig — contractsVersion", () => {
  it("inherits the built-in version when no override is supplied", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: AFFILIATE } } },
    });

    expect(config.getChainConfig(SymmioSupportedChainId.HYPER_EVM).contractsVersion).toBe("0.8.5");
  });

  it("lets an override restate the version — every version-branched seam follows it", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: AFFILIATE }, contractsVersion: "0.8.6" },
      },
    });

    expect(config.getChainConfig(SymmioSupportedChainId.HYPER_EVM).contractsVersion).toBe("0.8.6");
  });
});
