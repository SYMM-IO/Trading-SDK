import { describe, expect, it } from "vitest";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import type { DepositResponseSchemaV2 } from "../types/generated/listing-backend";
import { toMarketDepositAddress } from "./to-market-deposit-address";

describe("toMarketDepositAddress", () => {
  it("maps a full response into a MarketDepositAddress", () => {
    const raw: DepositResponseSchemaV2 = {
      token_contract_address: "0xToken",
      user_address: "0xUser",
      deposit_chain: ListingDepositChainId.HYPER_EVM,
      wallet_public_key: "0xDepositWallet",
      token_decimal: 18,
      market_status: "listed" as DepositResponseSchemaV2["market_status"],
    };

    expect(toMarketDepositAddress(raw)).toEqual({
      tokenContractAddress: "0xToken",
      userAddress: "0xUser",
      depositChain: ListingDepositChainId.HYPER_EVM,
      depositAddress: "0xDepositWallet",
      tokenDecimal: 18,
      marketStatus: ListingMarketStatus.LISTED,
    });
  });

  it("normalizes a null wallet_public_key to a null depositAddress", () => {
    const raw: DepositResponseSchemaV2 = {
      token_contract_address: "0xToken",
      user_address: "0xUser",
      deposit_chain: ListingDepositChainId.BASE,
      wallet_public_key: null,
      token_decimal: 6,
      market_status: "waiting_for_deposit" as DepositResponseSchemaV2["market_status"],
    };

    const mapped = toMarketDepositAddress(raw);

    expect(mapped.depositAddress).toBeNull();
    expect(mapped.depositChain).toBe(ListingDepositChainId.BASE);
    expect(mapped.marketStatus).toBe(ListingMarketStatus.WAITING_FOR_DEPOSIT);
  });
});
