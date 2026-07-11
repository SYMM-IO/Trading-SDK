import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { getTransferHistoryQueryKey, getTransferHistoryQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});
const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

describe("getTransferHistoryQueryOptions", () => {
  it("builds a stable key tagged with the action name and config fields", () => {
    const key = getTransferHistoryQueryKey({ accounts: [SUB], direction: "outgoing", configKey: "k" });
    expect(key[0]).toBe("getTransferHistory");
    expect(key[1]).toMatchObject({ accounts: [SUB], direction: "outgoing", configKey: "k" });
  });

  it("is enabled and wires the action when accounts are present", () => {
    const options = getTransferHistoryQueryOptions(config, { accounts: [SUB] });
    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getTransferHistory");
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled when accounts is empty", () => {
    expect(getTransferHistoryQueryOptions(config, { accounts: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false", () => {
    expect(getTransferHistoryQueryOptions(config, { accounts: [SUB], query: { enabled: false } }).enabled).toBe(false);
  });
});
