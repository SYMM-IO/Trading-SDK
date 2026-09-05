import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { getListingStatusQueryKey, getListingStatusQueryOptions } from "./query";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

describe("getListingStatusQueryKey", () => {
  it("tags the key with the action name and carries the market's address pair", () => {
    const key = getListingStatusQueryKey({
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.HYPER_EVM,
      configKey: "k",
    });

    expect(key[0]).toBe("getListingStatus");
    expect(key[1]).toMatchObject({
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.HYPER_EVM,
      configKey: "k",
    });
  });

  it("separates the same token listed from two deposit chains", () => {
    const params = { tokenContractAddress: TOKEN, configKey: "k" };
    const hyper = getListingStatusQueryKey({ ...params, depositChain: ListingDepositChainId.HYPER_EVM });
    const base = getListingStatusQueryKey({ ...params, depositChain: ListingDepositChainId.BASE });

    expect(base).not.toEqual(hyper);
  });
});

describe("getListingStatusQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getListingStatusQueryOptions(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.HYPER_EVM,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getListingStatus");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getListingStatusQueryOptions(config, {
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.HYPER_EVM,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("keeps a polling interval out of the key, so polling does not split the cache", () => {
    const { config } = mockConfig();
    const params = { tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.HYPER_EVM };

    expect(getListingStatusQueryOptions(config, { ...params, query: { refetchInterval: 5000 } }).queryKey).toEqual(
      getListingStatusQueryOptions(config, params).queryKey,
    );
  });
});
