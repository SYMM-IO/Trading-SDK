import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { addMarketMutationOptions } from "./query";

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("addMarketMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(addMarketMutationOptions(config).mutationKey).toEqual(["addMarket"]);
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const addMarket = vi.spyOn(await import("./add-market"), "addMarket").mockResolvedValue(undefined as never);

    await addMarketMutationOptions(config).mutationFn(VARIABLES);

    expect(addMarket).toHaveBeenCalledWith(config, VARIABLES);
    addMarket.mockRestore();
  });
});
