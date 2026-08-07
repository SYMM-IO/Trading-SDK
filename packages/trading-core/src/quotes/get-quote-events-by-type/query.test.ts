import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { getQuoteEventsByTypeQueryKey, getQuoteEventsByTypeQueryOptions } from "./query";
import { PRICE_HISTORY_EVENT_TYPES, QuoteEventType } from "./types";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getQuoteEventsByTypeQueryKey", () => {
  it("builds a stable, JSON-safe key tagged with the action name", () => {
    const key = getQuoteEventsByTypeQueryKey({
      quoteId: 7334n,
      types: PRICE_HISTORY_EVENT_TYPES,
      configKey: "k",
    });

    expect(key[0]).toBe("getQuoteEventsByType");
    /** bigint quoteId is stringified so the key survives structural hashing. */
    expect(key[1]).toMatchObject({ quoteId: "7334", types: [...PRICE_HISTORY_EVENT_TYPES], configKey: "k" });
  });

  it("clones the types array so the caller's input cannot mutate the key", () => {
    const types = [QuoteEventType.ChargeFundingRate];
    const key = getQuoteEventsByTypeQueryKey({ quoteId: 1n, types, configKey: "k" });
    expect(key[1].types).not.toBe(types);
    expect(key[1].types).toEqual(types);
  });
});

describe("getQuoteEventsByTypeQueryOptions", () => {
  it("is enabled and wires the action when types are present", () => {
    const options = getQuoteEventsByTypeQueryOptions(config, {
      quoteId: 7334n,
      types: PRICE_HISTORY_EVENT_TYPES,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getQuoteEventsByType");
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled when types is empty", () => {
    expect(getQuoteEventsByTypeQueryOptions(config, { quoteId: 7334n, types: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false", () => {
    const options = getQuoteEventsByTypeQueryOptions(config, {
      quoteId: 7334n,
      types: PRICE_HISTORY_EVENT_TYPES,
      query: { enabled: false },
    });
    expect(options.enabled).toBe(false);
  });
});
