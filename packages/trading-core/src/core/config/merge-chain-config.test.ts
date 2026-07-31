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
      enigma: { name: "Enigma", address: AFFILIATE, url: "https://enigma.test" },
      rasa: { name: "Rasa", address: AFFILIATE, url: "https://rasa.test" },
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
