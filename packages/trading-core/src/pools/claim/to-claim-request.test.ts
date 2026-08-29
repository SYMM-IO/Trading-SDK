import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toClaimRequest } from "./to-claim-request";

const REQUIRED = {
  accessToken: "t",
  tokenContractAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
  accountAddress: "0xSubAccount",
  amount: 5_300_000_000_000_000_000n,
} as const;

describe("toClaimRequest", () => {
  it("serializes the raw 1e18 bigint amount to a decimal string and maps the fields", () => {
    const body = toClaimRequest({ ...REQUIRED });

    expect(body.amount).toBe("5300000000000000000");
    expect(body.token_contract_address).toBe("0xToken");
    expect(body.deposit_chain).toBe(ListingDepositChainId.HYPER_EVM);
    expect(body.account_address).toBe("0xSubAccount");
  });
});
