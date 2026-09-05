import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import {
  getPoolRewardChartQueryKey,
  getPoolRewardChartQueryOptions,
  getPoolTotalRewardQueryKey,
  getPoolTotalRewardQueryOptions,
  getUserRewardChartQueryKey,
  getUserRewardChartQueryOptions,
  getUserTotalRewardQueryKey,
  getUserTotalRewardQueryOptions,
} from "./query";

const MARKET_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const USER = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";
const ACCESS_TOKEN = "bearer-token";

describe("getPoolRewardChartQueryOptions", () => {
  it("tags the key with the action name and carries the pool's address pair", () => {
    const key = getPoolRewardChartQueryKey({
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      configKey: "k",
    });

    expect(key[0]).toBe("getPoolRewardChart");
    expect(key[1]).toMatchObject({
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      configKey: "k",
    });
  });

  it("separates the same token listed from two deposit chains", () => {
    const base = getPoolRewardChartQueryKey({
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      configKey: "k",
    });
    const solana = getPoolRewardChartQueryKey({
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.SOLANA,
      configKey: "k",
    });

    expect(solana).not.toEqual(base);
  });

  it("is enabled by default, wires the action, and respects query.enabled = false", () => {
    const { config } = mockConfig();
    const params = { marketAddress: MARKET_ADDRESS, marketChainId: ListingDepositChainId.BASE };
    const options = getPoolRewardChartQueryOptions(config, params);

    expect(options.enabled).toBe(true);
    expect(typeof options.queryFn).toBe("function");
    expect(getPoolRewardChartQueryOptions(config, { ...params, query: { enabled: false } }).enabled).toBe(false);
  });
});

describe("getPoolTotalRewardQueryOptions", () => {
  it("keeps the window in the key, so two windows do not share a cache entry", () => {
    const params = { marketAddress: MARKET_ADDRESS, marketChainId: ListingDepositChainId.BASE, configKey: "k" };
    const week = getPoolTotalRewardQueryKey({ ...params, days: 7 });
    const month = getPoolTotalRewardQueryKey({ ...params, days: 30 });

    expect(week[0]).toBe("getPoolTotalReward");
    expect(week[1]).toMatchObject({ days: 7 });
    expect(month).not.toEqual(week);
  });

  it("is enabled by default, wires the action, and respects query.enabled = false", () => {
    const { config } = mockConfig();
    const params = { marketAddress: MARKET_ADDRESS, marketChainId: ListingDepositChainId.BASE, days: 30 };
    const options = getPoolTotalRewardQueryOptions(config, params);

    expect(options.enabled).toBe(true);
    expect(typeof options.queryFn).toBe("function");
    expect(getPoolTotalRewardQueryOptions(config, { ...params, query: { enabled: false } }).enabled).toBe(false);
  });
});

describe("getUserRewardChartQueryOptions", () => {
  it("keeps the bearer token out of the devtools-visible key", () => {
    const key = getUserRewardChartQueryKey({ accessToken: ACCESS_TOKEN, configKey: "k" });

    expect(key[0]).toBe("getUserRewardChart");
    expect(key[1]).not.toHaveProperty("accessToken");
    expect(JSON.stringify(key)).not.toContain(ACCESS_TOKEN);
  });

  it("shares one cache entry across a refreshed token, since the data is unchanged", () => {
    const first = getUserRewardChartQueryKey({ accessToken: ACCESS_TOKEN, configKey: "k" });
    const refreshed = getUserRewardChartQueryKey({ accessToken: "rotated-token", configKey: "k" });

    expect(refreshed).toEqual(first);
  });

  it("is enabled by default, wires the action, and respects query.enabled = false", () => {
    const { config } = mockConfig();
    const options = getUserRewardChartQueryOptions(config, { accessToken: ACCESS_TOKEN });

    expect(options.enabled).toBe(true);
    expect(typeof options.queryFn).toBe("function");
    expect(
      getUserRewardChartQueryOptions(config, { accessToken: ACCESS_TOKEN, query: { enabled: false } }).enabled,
    ).toBe(false);
  });
});

describe("getUserTotalRewardQueryOptions", () => {
  it("drops the bearer token but keeps the user and window the figure is scoped to", () => {
    const key = getUserTotalRewardQueryKey({
      accessToken: ACCESS_TOKEN,
      userAddress: USER,
      days: 30,
      configKey: "k",
    });

    expect(key[0]).toBe("getUserTotalReward");
    expect(key[1]).toMatchObject({ userAddress: USER, days: 30 });
    expect(key[1]).not.toHaveProperty("accessToken");
  });

  it("separates two users on the same window", () => {
    const params = { accessToken: ACCESS_TOKEN, days: 30, configKey: "k" };
    const mine = getUserTotalRewardQueryKey({ ...params, userAddress: USER });
    const theirs = getUserTotalRewardQueryKey({ ...params, userAddress: "0x1111111111111111111111111111111111111111" });

    expect(theirs).not.toEqual(mine);
  });

  it("is enabled by default, wires the action, and respects query.enabled = false", () => {
    const { config } = mockConfig();
    const params = { accessToken: ACCESS_TOKEN, userAddress: USER, days: 30 };
    const options = getUserTotalRewardQueryOptions(config, params);

    expect(options.enabled).toBe(true);
    expect(typeof options.queryFn).toBe("function");
    expect(getUserTotalRewardQueryOptions(config, { ...params, query: { enabled: false } }).enabled).toBe(false);
  });
});
