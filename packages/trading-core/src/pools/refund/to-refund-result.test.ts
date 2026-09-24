import { describe, expect, it } from "vitest";
import { toRefundResult } from "./to-refund-result";

describe("toRefundResult", () => {
  it("maps tx_hash to transactionHash", () => {
    expect(toRefundResult({ tx_hash: "0xabc" })).toEqual({ transactionHash: "0xabc" });
  });
});
