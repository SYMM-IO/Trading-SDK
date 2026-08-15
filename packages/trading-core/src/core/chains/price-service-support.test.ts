import { describe, expect, it } from "vitest";
import { assertSupportedPriceServiceType } from "./price-service-support";
import { SUPPORTED_PRICE_SERVICE_TYPES } from "./types";

const CHAIN = 999;

describe("assertSupportedPriceServiceType", () => {
  it.each(SUPPORTED_PRICE_SERVICE_TYPES)("accepts the supported type %s", (type) => {
    expect(() => assertSupportedPriceServiceType(CHAIN, type)).not.toThrow();
  });

  it("throws for a type the SDK has no client for", () => {
    expect(() => assertSupportedPriceServiceType(CHAIN, "pyth")).toThrow(/"pyth"/);
    expect(() => assertSupportedPriceServiceType(CHAIN, "pyth")).toThrow(/not supported/i);
  });

  it("names the chain in the message", () => {
    expect(() => assertSupportedPriceServiceType(CHAIN, "pyth")).toThrow(new RegExp(`chain ${CHAIN}`));
  });

  it("names the solver when validating a solver-nested override", () => {
    expect(() => assertSupportedPriceServiceType(CHAIN, "pyth", "rasa")).toThrow(/solver "rasa"/);
  });

  it("lists the supported types so the fix is obvious", () => {
    expect(() => assertSupportedPriceServiceType(CHAIN, "pyth")).toThrow(
      new RegExp(SUPPORTED_PRICE_SERVICE_TYPES.join(", ")),
    );
  });
});
