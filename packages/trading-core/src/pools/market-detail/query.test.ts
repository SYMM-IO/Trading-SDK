import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { getListingMarketDetailQueryKey, getListingMarketDetailQueryOptions } from "./query";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

describe("getListingMarketDetailQueryKey", () => {
  it("tags the key with the action name and carries the pool's address pair", () => {
    const key = getListingMarketDetailQueryKey({
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
      configKey: "k",
    });

    expect(key[0]).toBe("getListingMarketDetail");
    expect(key[1]).toMatchObject({
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
      configKey: "k",
    });
  });

  it("separates the same token listed from two deposit chains", () => {
    const base = getListingMarketDetailQueryKey({
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
      configKey: "k",
    });
    const solana = getListingMarketDetailQueryKey({
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.SOLANA,
      configKey: "k",
    });

    expect(solana).not.toEqual(base);
  });
});

describe("getListingMarketDetailQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getListingMarketDetailQueryOptions(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getListingMarketDetail");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getListingMarketDetailQueryOptions(config, {
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.BASE,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("drops TanStack control fields from the key, so staleTime does not split the cache", () => {
    const { config } = mockConfig();
    const plain = getListingMarketDetailQueryOptions(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
    });
    const tuned = getListingMarketDetailQueryOptions(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
      query: { staleTime: 60_000 },
    });

    expect(tuned.queryKey).toEqual(plain.queryKey);
  });
});
