import { describe, expect, it } from "vitest";
import type { GetClaimResponseSchema, SearchClaimsResponseSchema } from "../types/generated/listing-backend";
import { toPoolClaim, toPoolClaimHistoryPage } from "./to-pool-claim";

const RECORD: GetClaimResponseSchema = {
  claim_request_id: "claim-123",
  wallet_id: "wallet-uuid",
  market_id: "market-uuid",
  amount: "0.037699391270769714",
  account_address: "0xSubAccount",
  create_time: 1_700_000_000,
  transaction_hash: "0xabc",
};

describe("toPoolClaim", () => {
  it("maps a record, scaling the plain-decimal amount up to a 1e18 bigint", () => {
    expect(toPoolClaim({ ...RECORD })).toEqual({
      claimRequestId: "claim-123",
      accountAddress: "0xSubAccount",
      amount: 37699391270769714n,
      transactionHash: "0xabc",
      time: 1_700_000_000,
    });
  });

  it("defaults a missing amount to 0n and a missing hash to null", () => {
    const result = toPoolClaim({ ...RECORD, amount: "", transaction_hash: null });
    expect(result.amount).toBe(0n);
    expect(result.transactionHash).toBeNull();
  });
});

describe("toPoolClaimHistoryPage", () => {
  it("maps the envelope to count + items", () => {
    const raw: SearchClaimsResponseSchema = { total: 7, data: [RECORD] };
    const page = toPoolClaimHistoryPage(raw);
    expect(page.count).toBe(7);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.claimRequestId).toBe("claim-123");
  });

  it("tolerates an absent data array", () => {
    expect(toPoolClaimHistoryPage({ total: 0 } as SearchClaimsResponseSchema)).toEqual({ count: 0, items: [] });
  });
});
