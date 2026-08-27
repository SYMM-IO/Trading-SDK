import { describe, expect, it } from "vitest";
import { toWithdrawRequest } from "./to-withdraw-request";

const REQUIRED = {
  accessToken: "t",
  marketAddress: "0xToken",
  withdrawAddress: "0xRecipient",
  amount: 5_300_000_000_000_000_000n,
} as const;

describe("toWithdrawRequest", () => {
  it("serializes the raw 1e18 bigint amount to a decimal string and maps the addresses", () => {
    const body = toWithdrawRequest({ ...REQUIRED });

    expect(body.amount).toBe("5300000000000000000");
    expect(body.market_address).toBe("0xToken");
    expect(body.withdraw_address).toBe("0xRecipient");
  });

  it("includes `description` only when it is set", () => {
    expect(toWithdrawRequest({ ...REQUIRED })).not.toHaveProperty("description");

    const withNote = toWithdrawRequest({ ...REQUIRED, description: "rebalancing" });
    expect(withNote.description).toBe("rebalancing");
  });
});
