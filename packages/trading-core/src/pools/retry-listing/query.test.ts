import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { getRetryListingInfoQueryKey, getRetryListingInfoQueryOptions, retryListingMutationOptions } from "./query";

const PARAMS = {
  accessToken: "secret",
  tokenContractAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("getRetryListingInfoQueryKey", () => {
  it("drops the accessToken credential from the key", () => {
    const key = getRetryListingInfoQueryKey({ ...PARAMS, configKey: "chain-999" });
    expect(key[0]).toBe("getRetryListingInfo");
    expect(JSON.stringify(key)).not.toContain("secret");
    expect(JSON.stringify(key)).toContain("0xToken");
  });
});

describe("getRetryListingInfoQueryOptions", () => {
  it("wires the queryFn to the action", async () => {
    const { config } = mockConfig();
    const spy = vi
      .spyOn(await import("./get-retry-listing-info"), "getRetryListingInfo")
      .mockResolvedValue({ retryLimit: 3, remainingRetries: 2, remainingCooldownSeconds: null });

    const options = getRetryListingInfoQueryOptions(config, { ...PARAMS });
    expect(options.queryKey[0]).toBe("getRetryListingInfo");
    await (options.queryFn as () => Promise<unknown>)();
    expect(spy).toHaveBeenCalledWith(config, expect.objectContaining({ tokenContractAddress: "0xToken" }));
    spy.mockRestore();
  });
});

describe("retryListingMutationOptions", () => {
  it("tags the mutation and binds the config", async () => {
    const { config } = mockConfig();
    expect(retryListingMutationOptions(config).mutationKey).toEqual(["retryListing"]);

    const spy = vi
      .spyOn(await import("./retry-listing"), "retryListing")
      .mockResolvedValue({ retryLimit: 3, remainingRetries: 1, cooldownSeconds: 3600 });
    await retryListingMutationOptions(config).mutationFn({ ...PARAMS });
    expect(spy).toHaveBeenCalledWith(config, { ...PARAMS });
    spy.mockRestore();
  });
});
