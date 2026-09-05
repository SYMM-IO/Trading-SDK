import { describe, expect, it } from "vitest";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import type { AddMarketDepositResponseSchemaV2 } from "../types/generated/listing-backend";
import { toCreatedPool } from "./to-created-pool";

describe("toCreatedPool", () => {
  it("maps a full response into a CreatedPool", () => {
    const raw: AddMarketDepositResponseSchemaV2 = {
      token_contract_address: "0xToken",
      user_address: "0xUser",
      token_name: "Symmio",
      token_ticker: "SYMM",
      is_tax: false,
      user_whitelist_tax: false,
      buy_back_ratio: 50,
      max_leverage: 20,
      deposit_chain: ListingDepositChainId.BASE,
      wallet_public_key: "0xDepositWallet",
      main_pool: "0xPool",
      cex_list: ["Binance"],
      token_decimal: 18,
      additional_chains: [56],
      market_status: "waiting_for_deposit" as AddMarketDepositResponseSchemaV2["market_status"],
    };

    expect(toCreatedPool(raw)).toEqual({
      tokenContractAddress: "0xToken",
      userAddress: "0xUser",
      tokenName: "Symmio",
      tokenTicker: "SYMM",
      tokenDecimal: 18,
      buyBackRatio: 50,
      maxLeverage: 20,
      depositChain: ListingDepositChainId.BASE,
      marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
      walletPublicKey: "0xDepositWallet",
      mainPool: "0xPool",
    });
  });

  it("normalizes a null wallet_public_key and main_pool to null", () => {
    const raw: AddMarketDepositResponseSchemaV2 = {
      token_contract_address: "0xToken",
      user_address: "0xUser",
      token_name: "Symmio",
      token_ticker: "SYMM",
      buy_back_ratio: 50,
      max_leverage: 20,
      deposit_chain: ListingDepositChainId.BASE,
      wallet_public_key: null,
      main_pool: null,
      token_decimal: 18,
      market_status: "waiting_for_deposit" as AddMarketDepositResponseSchemaV2["market_status"],
    };

    const pool = toCreatedPool(raw);

    expect(pool.walletPublicKey).toBeNull();
    expect(pool.mainPool).toBeNull();
  });
});
