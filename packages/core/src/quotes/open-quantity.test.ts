import { describe, expect, it } from "vitest";
import { quoteOpenQuantity } from "./open-quantity";

describe("quoteOpenQuantity", () => {
  it("subtracts closedAmount from quantity for a partially-closed position", () => {
    expect(quoteOpenQuantity({ quantity: 142_191812000000000000n, closedAmount: 100_000000000000000000n })).toBe(
      42_191812000000000000n,
    );
  });

  it("equals quantity when nothing has been closed yet", () => {
    expect(quoteOpenQuantity({ quantity: 100n, closedAmount: 0n })).toBe(100n);
  });

  it("treats an absent closedAmount as zero (optimistic open)", () => {
    expect(quoteOpenQuantity({ quantity: 250n, closedAmount: undefined })).toBe(250n);
  });

  it("is zero once the position is fully closed (closedAmount === quantity)", () => {
    expect(quoteOpenQuantity({ quantity: 100n, closedAmount: 100n })).toBe(0n);
  });
});
