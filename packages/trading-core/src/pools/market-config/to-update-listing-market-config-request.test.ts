import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toUpdateListingMarketConfigRequest } from "./to-update-listing-market-config-request";

const BASE = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("toUpdateListingMarketConfigRequest", () => {
  it("sends both knobs when both are supplied", () => {
    expect(toUpdateListingMarketConfigRequest({ ...BASE, maxLeverage: 20, buybackRatio: 50 })).toEqual({
      token_contract_address: BASE.tokenContractAddress,
      deposit_chain: ListingDepositChainId.HYPER_EVM,
      max_leverage: 20,
      buyback_ratio: 50,
    });
  });

  it("omits an absent knob instead of sending null, so the caller's current value survives", () => {
    const body = toUpdateListingMarketConfigRequest({ ...BASE, buybackRatio: 0 });

    expect(body).not.toHaveProperty("max_leverage");
    expect(body.buyback_ratio).toBe(0);
  });

  it("keeps a zero buyback — 0% is a value, not an omission", () => {
    expect(toUpdateListingMarketConfigRequest({ ...BASE, maxLeverage: 1, buybackRatio: 0 })).toMatchObject({
      max_leverage: 1,
      buyback_ratio: 0,
    });
  });
});
