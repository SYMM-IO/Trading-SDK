import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { getQuoteHistoryQueryKey, getQuoteHistoryQueryOptions } from "./query";
import { QuoteCloseType } from "./types";

const config = createConfig({ getClient: () => ({}) as PublicClient });
const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

describe("getQuoteHistoryQueryOptions", () => {
  it("builds a stable key tagged with the action name and config fields", () => {
    const key = getQuoteHistoryQueryKey({ subAccounts: [SUB], closeType: QuoteCloseType.Closed, configKey: "k" });
    expect(key[0]).toBe("getQuoteHistory");
    expect(key[1]).toMatchObject({ subAccounts: [SUB], closeType: QuoteCloseType.Closed, configKey: "k" });
  });

  it("is enabled and wires the action when subAccounts are present", () => {
    const options = getQuoteHistoryQueryOptions(config, { subAccounts: [SUB] });
    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getQuoteHistory");
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled when subAccounts is empty", () => {
    expect(getQuoteHistoryQueryOptions(config, { subAccounts: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false", () => {
    expect(getQuoteHistoryQueryOptions(config, { subAccounts: [SUB], query: { enabled: false } }).enabled).toBe(false);
  });
});
