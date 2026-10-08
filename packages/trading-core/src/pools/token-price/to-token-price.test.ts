import { describe, expect, it } from "vitest";
import type { SymbolPriceResponse } from "../types/generated/listing-backend";
import { toTokenPrice } from "./to-token-price";

describe("toTokenPrice", () => {
  it("carries the USD price through as a TokenPrice", () => {
    const raw: SymbolPriceResponse = { price: 0.000123 };

    expect(toTokenPrice(raw)).toEqual({ price: 0.000123 });
  });
});
