import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig as getBuiltInChainConfig } from "../chains/actions/get-chain-config";
import { SymmioSupportedChainId } from "../chains/supported-chains";
import { createConfig } from "./create-config";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const CHAIN = SymmioSupportedChainId.ARBITRUM;

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
      symmioConfig: { [SymmioSupportedChainId.BASE]: { addresses: { affiliatesAddress: AFFILIATE } } },
    });

    expect(config.getChainConfig(SymmioSupportedChainId.BASE).contractsVersion).toBe("0.8.5");
  });

  it("lets an override restate the version — every version-branched seam follows it", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE }, contractsVersion: "0.8.6" },
      },
    });

    expect(config.getChainConfig(SymmioSupportedChainId.ARBITRUM).contractsVersion).toBe("0.8.6");
  });
});

describe("mergeChainConfig — expressWithdraw", () => {
  const providerAddress = "0x573310D7b04fF21BB8628C69eE103dDF4922294A" as const;

  it("keeps Express Withdraw absent from built-in production chains", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: AFFILIATE } } },
    });

    expect(config.getChainConfig(CHAIN).expressWithdraw).toBeUndefined();
  });

  it("accepts a complete base-less service override", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [CHAIN]: {
          addresses: { affiliatesAddress: AFFILIATE },
          expressWithdraw: { url: "/api/express-withdraw", providerAddress },
        },
      },
    });

    expect(config.getChainConfig(CHAIN).expressWithdraw).toEqual({
      url: "/api/express-withdraw",
      providerAddress,
    });
  });

  it("rejects a partial base-less service override", () => {
    expect(() =>
      createConfig({
        getClient: () => ({}) as PublicClient,
        symmioConfig: {
          [CHAIN]: {
            addresses: { affiliatesAddress: AFFILIATE },
            expressWithdraw: { url: "/api/express-withdraw" },
          },
        },
      }),
    ).toThrow(/EXPRESS_WITHDRAW_OVERRIDE_INCOMPLETE|providerAddress/);
  });
});

describe("mergeChainConfig — gasless", () => {
  const ARBITRUM = SymmioSupportedChainId.ARBITRUM;
  /** No chain in the registry ships a built-in gasless block. */
  const BASE_LESS = SymmioSupportedChainId.BASE;
  const GASLESS = {
    url: "https://gaslessq.symmio.foundation",
    protocolInstance: "arbitrum-42161-vibe",
    gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
  } as const;

  it("keeps the key absent when neither side configures the service", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: { [BASE_LESS]: { addresses: { affiliatesAddress: AFFILIATE } } },
    });

    expect("gasless" in config.getChainConfig(BASE_LESS)).toBe(false);
  });

  it("keeps the key absent on Arbitrum too when nothing configures the service", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: { [ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE } } },
    });

    expect("gasless" in config.getChainConfig(ARBITRUM)).toBe(false);
  });

  it("throws GASLESS_OVERRIDE_INCOMPLETE for a partial Arbitrum override — there is no built-in block to inherit", () => {
    expect(() =>
      createConfig({
        getClient: () => ({}) as PublicClient,
        symmioConfig: {
          [ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE }, gasless: { url: "/api/gasless" } },
        },
      }),
    ).toThrowError(/GASLESS_OVERRIDE_INCOMPLETE|gaslessLayerAddress/);
  });

  it("accepts a complete base-less override", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: { [ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE }, gasless: { ...GASLESS } } },
    });

    expect(config.getChainConfig(ARBITRUM).gasless).toEqual({
      url: GASLESS.url,
      protocolInstance: GASLESS.protocolInstance,
      gaslessLayerAddress: GASLESS.gaslessLayerAddress,
      apiKey: undefined,
    });
  });

  it("merges the nested execution block and keeps apiKey when supplied", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [ARBITRUM]: {
          addresses: { affiliatesAddress: AFFILIATE },
          gasless: { ...GASLESS, apiKey: "test-key", execution: { mode: "gasless", fallback: "wallet" } },
        },
      },
    });

    const gasless = config.getChainConfig(ARBITRUM).gasless;
    expect(gasless?.apiKey).toBe("test-key");
    expect(gasless?.execution).toEqual({ mode: "gasless", fallback: "wallet" });
  });

  it("throws GASLESS_OVERRIDE_INCOMPLETE for a base-less override missing the layer address", () => {
    expect(() =>
      createConfig({
        getClient: () => ({}) as PublicClient,
        symmioConfig: {
          [BASE_LESS]: { addresses: { affiliatesAddress: AFFILIATE }, gasless: { url: GASLESS.url } },
        },
      }),
    ).toThrowError(/GASLESS_OVERRIDE_INCOMPLETE|gaslessLayerAddress/);
  });
});
