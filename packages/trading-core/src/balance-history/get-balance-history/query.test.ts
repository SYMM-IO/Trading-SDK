import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { getBalanceHistoryQueryKey, getBalanceHistoryQueryOptions } from "./query";
import { BalanceHistoryFilter } from "./types";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});
const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

describe("getBalanceHistoryQueryOptions", () => {
  it("builds a stable key tagged with the action name and config fields", () => {
    const key = getBalanceHistoryQueryKey({ accounts: [SUB], filter: BalanceHistoryFilter.Deposit, configKey: "k" });
    expect(key[0]).toBe("getBalanceHistory");
    expect(key[1]).toMatchObject({ accounts: [SUB], filter: BalanceHistoryFilter.Deposit, configKey: "k" });
  });

  it("is enabled and wires the action when accounts are present", () => {
    const options = getBalanceHistoryQueryOptions(config, { accounts: [SUB] });
    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getBalanceHistory");
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled when accounts is empty", () => {
    expect(getBalanceHistoryQueryOptions(config, { accounts: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false", () => {
    expect(getBalanceHistoryQueryOptions(config, { accounts: [SUB], query: { enabled: false } }).enabled).toBe(false);
  });
});
