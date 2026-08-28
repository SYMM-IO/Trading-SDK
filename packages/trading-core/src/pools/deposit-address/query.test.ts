import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { getDepositAddressQueryKey, getDepositAddressQueryOptions } from "./query";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const ACCESS_TOKEN = "eyJhbGc.header.sig";

describe("getDepositAddressQueryKey", () => {
  it("tags the key with the action name and carries the pool's address pair", () => {
    const key = getDepositAddressQueryKey({
      accessToken: ACCESS_TOKEN,
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
      configKey: "k",
    });

    expect(key[0]).toBe("getDepositAddress");
    expect(key[1]).toMatchObject({ tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.BASE });
  });

  it("keeps the bearer token out of the devtools-visible key", () => {
    const key = getDepositAddressQueryKey({
      accessToken: ACCESS_TOKEN,
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
      configKey: "k",
    });

    expect(key[1]).not.toHaveProperty("accessToken");
    expect(JSON.stringify(key)).not.toContain(ACCESS_TOKEN);
  });

  it("separates the same token deposited from two chains", () => {
    const params = { accessToken: ACCESS_TOKEN, tokenContractAddress: TOKEN, configKey: "k" };
    const base = getDepositAddressQueryKey({ ...params, depositChain: ListingDepositChainId.BASE });
    const solana = getDepositAddressQueryKey({ ...params, depositChain: ListingDepositChainId.SOLANA });

    expect(solana).not.toEqual(base);
  });
});

describe("getDepositAddressQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getDepositAddressQueryOptions(config, {
      accessToken: ACCESS_TOKEN,
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getDepositAddress");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getDepositAddressQueryOptions(config, {
        accessToken: ACCESS_TOKEN,
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.BASE,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });
});
