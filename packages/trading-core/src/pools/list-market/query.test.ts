import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import type { CreatedPool } from "../add-market/types";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { listMarketMutationOptions } from "./query";

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

const POOL: CreatedPool = {
  tokenContractAddress: VARIABLES.tokenContractAddress,
  userAddress: "0xUser",
  tokenName: "Symmio",
  tokenTicker: "SYMM",
  tokenDecimal: 18,
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.HYPER_EVM,
  marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
  walletPublicKey: "0xDepositWallet",
  mainPool: null,
};

describe("listMarketMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(listMarketMutationOptions(config).mutationKey).toEqual(["listMarket"]);
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const listMarket = vi.spyOn(await import("./list-market"), "listMarket").mockResolvedValue(POOL);

    await expect(listMarketMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(POOL);

    expect(listMarket).toHaveBeenCalledWith(config, VARIABLES);
    listMarket.mockRestore();
  });
});
