import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getUserProfitQueryKey, getUserProfitQueryOptions } from "./query";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const ACCESS_TOKEN = "eyJhbGc.header.sig";

describe("getUserProfitQueryKey", () => {
  it("tags the key with the action name and carries the pool it is scoped to", () => {
    const key = getUserProfitQueryKey({ accessToken: ACCESS_TOKEN, tokenContractAddress: TOKEN, configKey: "k" });

    expect(key[0]).toBe("getUserProfit");
    expect(key[1]).toMatchObject({ tokenContractAddress: TOKEN, configKey: "k" });
  });

  it("keeps the bearer token out of the devtools-visible key", () => {
    const key = getUserProfitQueryKey({ accessToken: ACCESS_TOKEN, tokenContractAddress: TOKEN, configKey: "k" });

    expect(key[1]).not.toHaveProperty("accessToken");
    expect(JSON.stringify(key)).not.toContain(ACCESS_TOKEN);
  });

  it("shares one cache entry across a refreshed token, since the data is unchanged", () => {
    const first = getUserProfitQueryKey({ accessToken: ACCESS_TOKEN, tokenContractAddress: TOKEN, configKey: "k" });
    const refreshed = getUserProfitQueryKey({ accessToken: "rotated", tokenContractAddress: TOKEN, configKey: "k" });

    expect(refreshed).toEqual(first);
  });
});

describe("getUserProfitQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getUserProfitQueryOptions(config, { accessToken: ACCESS_TOKEN, tokenContractAddress: TOKEN });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getUserProfit");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getUserProfitQueryOptions(config, {
        accessToken: ACCESS_TOKEN,
        tokenContractAddress: TOKEN,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });
});
