import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import {
  getListingMarketConfigQueryKey,
  getListingMarketConfigQueryOptions,
  updateListingMarketConfigMutationOptions,
} from "./query";

const OPTIONS = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("getListingMarketConfigQueryKey", () => {
  it("keys by the market and drops the bearer token", () => {
    const key = getListingMarketConfigQueryKey({ ...OPTIONS, configKey: "hyperEvm" });

    expect(key[0]).toBe("getListingMarketConfig");
    expect(key[1]).toMatchObject({
      tokenContractAddress: OPTIONS.tokenContractAddress,
      depositChain: ListingDepositChainId.HYPER_EVM,
      configKey: "hyperEvm",
    });
    expect(key[1]).not.toHaveProperty("accessToken");
  });
});

describe("getListingMarketConfigQueryOptions", () => {
  it("builds an enabled query bound to the config", () => {
    const { config } = mockConfig();
    const options = getListingMarketConfigQueryOptions(config, OPTIONS);

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getListingMarketConfig");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects a caller's enabled override", () => {
    const { config } = mockConfig();
    const options = getListingMarketConfigQueryOptions(config, { ...OPTIONS, query: { enabled: false } });

    expect(options.enabled).toBe(false);
  });

  it("forwards every parameter to the action", async () => {
    const { config } = mockConfig();
    const getListingMarketConfig = vi
      .spyOn(await import("./get-listing-market-config"), "getListingMarketConfig")
      .mockResolvedValue({
        tokenContractAddress: OPTIONS.tokenContractAddress,
        depositChain: ListingDepositChainId.HYPER_EVM,
        userMaxLeverage: null,
        userBuybackRatio: null,
        maxLeverage: 20,
        buybackRatio: 50,
      });

    await getListingMarketConfigQueryOptions(config, OPTIONS).queryFn();

    expect(getListingMarketConfig).toHaveBeenCalledWith(config, {
      chainId: undefined,
      accessToken: OPTIONS.accessToken,
      tokenContractAddress: OPTIONS.tokenContractAddress,
      depositChain: ListingDepositChainId.HYPER_EVM,
    });
    getListingMarketConfig.mockRestore();
  });
});

describe("updateListingMarketConfigMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(updateListingMarketConfigMutationOptions(config).mutationKey).toEqual(["updateListingMarketConfig"]);
  });

  it("is a mutation, not cached data — the update is a one-shot write", () => {
    const { config } = mockConfig();
    const options = updateListingMarketConfigMutationOptions(config);

    expect(typeof options.mutationFn).toBe("function");
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const variables = { ...OPTIONS, buybackRatio: 50, maxLeverage: 20 };
    const updateListingMarketConfig = vi
      .spyOn(await import("./update-listing-market-config"), "updateListingMarketConfig")
      .mockResolvedValue({
        tokenContractAddress: OPTIONS.tokenContractAddress,
        depositChain: ListingDepositChainId.HYPER_EVM,
        userMaxLeverage: 20,
        userBuybackRatio: 50,
        maxLeverage: 20,
        buybackRatio: 50,
      });

    await updateListingMarketConfigMutationOptions(config).mutationFn(variables);

    expect(updateListingMarketConfig).toHaveBeenCalledWith(config, variables);
    updateListingMarketConfig.mockRestore();
  });
});
