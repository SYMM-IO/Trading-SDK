import { describe, expect, it } from "vitest";
import type { ClaimProfitResponseSchema } from "../types/generated/listing-backend";
import { toClaimResult } from "./to-claim-result";

const RESPONSE: ClaimProfitResponseSchema = {
  status: "ok",
  // Plain decimal units (dollars), like claimable_reward on /v2/profit — scaled up to 1e18.
  amount: "5.3",
  claim_request_id: "claim-123",
  transaction_hash: "0xabc",
};

describe("toClaimResult", () => {
  it("maps the response, scaling the plain-decimal amount up to a 1e18 bigint", () => {
    const result = toClaimResult({ ...RESPONSE });

    expect(result).toEqual({
      status: "ok",
      amountClaimed: 5_300_000_000_000_000_000n,
      claimRequestId: "claim-123",
      transactionHash: "0xabc",
    });
  });

  it("defaults a missing amount to 0n and a missing hash to null", () => {
    const result = toClaimResult({ status: "ok", amount: "", claim_request_id: "claim-1" });

    expect(result.amountClaimed).toBe(0n);
    expect(result.transactionHash).toBeNull();
  });
});
