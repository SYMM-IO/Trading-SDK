import { describe, expect, it } from "vitest";
import type { SymmioPriceServiceConfig } from "../core/chains/types";
import { SymmError } from "../shared/errors/symm-error";
import { assertPriceServiceProvider } from "./assert-price-service-provider";

const ENIGMA: SymmioPriceServiceConfig = {
  type: "enigma",
  url: "https://lowcap-price.enigma.bz",
  wsUrl: "wss://lowcap-price.enigma.bz/ws",
};

const BINANCE: SymmioPriceServiceConfig = {
  type: "binance",
  url: "https://fapi.binance.com",
  wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
};

describe("assertPriceServiceProvider", () => {
  it("passes when the resolved provider matches", () => {
    expect(() => assertPriceServiceProvider(ENIGMA, "enigma", "getEnigmaPriceServicePricesByNames")).not.toThrow();
    expect(() => assertPriceServiceProvider(BINANCE, "binance", "getBinancePremiumIndex")).not.toThrow();
  });

  it("throws UNSUPPORTED_BY_PRICE_SERVICE when the provider differs", () => {
    try {
      assertPriceServiceProvider(BINANCE, "enigma", "watchEnigmaPrices");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SymmError);
      expect((err as SymmError).code).toBe("UNSUPPORTED_BY_PRICE_SERVICE");
      expect((err as SymmError).kind).toBe("config");
    }
  });

  it("names the action and both providers so the misconfiguration is obvious", () => {
    expect(() => assertPriceServiceProvider(BINANCE, "enigma", "watchEnigmaPrices")).toThrow(/watchEnigmaPrices/);
    expect(() => assertPriceServiceProvider(BINANCE, "enigma", "watchEnigmaPrices")).toThrow(/"binance"/);
    expect(() => assertPriceServiceProvider(BINANCE, "enigma", "watchEnigmaPrices")).toThrow(/"enigma"/);
  });
});
