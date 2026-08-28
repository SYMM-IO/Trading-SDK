import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toAddMarketRequest } from "./to-add-market-request";

const REQUIRED = {
  accessToken: "t",
  tokenContractAddress: "0xToken",
  buyBackRatio: 50,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.BASE,
} as const;

describe("toAddMarketRequest", () => {
  it("always maps the required fields and the deposit chain", () => {
    const body = toAddMarketRequest({ ...REQUIRED });

    expect(body.token_contract_address).toBe("0xToken");
    expect(body.buy_back_ratio).toBe(50);
    expect(body.max_leverage).toBe(20);
    expect(body.deposit_chain).toBe(ListingDepositChainId.BASE);
    // `deposit_chain` is the numeric ListingDepositChainId value.
    expect(body.deposit_chain as unknown as number).toBe(8453);
  });

  it("sends a defined `isTax: false` as `is_tax: false`", () => {
    const body = toAddMarketRequest({ ...REQUIRED, isTax: false });

    expect(body).toHaveProperty("is_tax", false);
  });

  it("sends a defined empty `additionalChains: []` as `additional_chains: []`", () => {
    const body = toAddMarketRequest({ ...REQUIRED, additionalChains: [] });

    expect(body).toHaveProperty("additional_chains");
    expect(body.additional_chains).toEqual([]);
  });

  it("maps every defined extra to its wire key", () => {
    const body = toAddMarketRequest({
      ...REQUIRED,
      isTax: true,
      userWhitelistTax: true,
      additionalChains: [56, 42161],
      poolAddress: "0xPool",
      cexList: ["Binance"],
    });

    expect(body.is_tax).toBe(true);
    expect(body.user_whitelist_tax).toBe(true);
    expect(body.additional_chains).toEqual([56, 42161]);
    expect(body.pool_address).toBe("0xPool");
    expect(body.cex_list).toEqual(["Binance"]);
  });

  it("omits every extra left undefined", () => {
    const body = toAddMarketRequest({ ...REQUIRED });

    expect(body).not.toHaveProperty("is_tax");
    expect(body).not.toHaveProperty("user_whitelist_tax");
    expect(body).not.toHaveProperty("additional_chains");
    expect(body).not.toHaveProperty("pool_address");
    expect(body).not.toHaveProperty("cex_list");
  });
});
