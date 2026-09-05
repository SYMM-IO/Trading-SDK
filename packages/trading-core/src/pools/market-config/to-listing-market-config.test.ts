import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toListingMarketConfig } from "./to-listing-market-config";

describe("toListingMarketConfig", () => {
  it("maps the wire body to camelCase without rescaling the whole numbers", () => {
    expect(
      toListingMarketConfig({
        token_contract_address: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
        deposit_chain: ListingDepositChainId.HYPER_EVM,
        user_max_leverage: 10,
        user_buyback_ratio: 75,
        max_leverage: 20,
        buyback_ratio: 50,
      }),
    ).toEqual({
      tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
      depositChain: ListingDepositChainId.HYPER_EVM,
      userMaxLeverage: 10,
      userBuybackRatio: 75,
      maxLeverage: 20,
      buybackRatio: 50,
    });
  });

  it("normalizes an absent user opinion to null, whether it arrives as null or undefined", () => {
    const fromNull = toListingMarketConfig({
      token_contract_address: "0xToken",
      deposit_chain: ListingDepositChainId.BASE,
      user_max_leverage: null,
      user_buyback_ratio: null,
      max_leverage: 20,
      buyback_ratio: 50,
    });
    const fromUndefined = toListingMarketConfig({
      token_contract_address: "0xToken",
      deposit_chain: ListingDepositChainId.BASE,
      max_leverage: 20,
      buyback_ratio: 50,
    });

    expect(fromNull.userMaxLeverage).toBeNull();
    expect(fromNull.userBuybackRatio).toBeNull();
    expect(fromUndefined.userMaxLeverage).toBeNull();
    expect(fromUndefined.userBuybackRatio).toBeNull();
  });
});
