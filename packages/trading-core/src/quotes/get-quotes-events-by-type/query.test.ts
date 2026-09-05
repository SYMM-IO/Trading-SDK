import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { FUNDING_HISTORY_EVENT_TYPES, QuoteEventType } from "../get-quote-events-by-type/types";
import { getQuotesEventsByTypeQueryKey, getQuotesEventsByTypeQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getQuotesEventsByTypeQueryKey", () => {
  it("builds a stable, JSON-safe key tagged with the action name", () => {
    const key = getQuotesEventsByTypeQueryKey({
      quoteIds: [7334n, 7335n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      configKey: "k",
    });

    expect(key[0]).toBe("getQuotesEventsByType");
    /** bigint quote ids are stringified so the key survives structural hashing. */
    expect(key[1]).toMatchObject({
      quoteIds: ["7334", "7335"],
      types: [...FUNDING_HISTORY_EVENT_TYPES],
      configKey: "k",
    });
  });

  it("sorts the quote ids so id order does not fragment the cache", () => {
    const ascending = getQuotesEventsByTypeQueryKey({
      quoteIds: [7334n, 7335n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      configKey: "k",
    });
    const descending = getQuotesEventsByTypeQueryKey({
      quoteIds: [7335n, 7334n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      configKey: "k",
    });

    expect(descending).toEqual(ascending);
    expect(descending[1].quoteIds).toEqual(["7334", "7335"]);
  });

  it("sorts numerically, not lexicographically", () => {
    const key = getQuotesEventsByTypeQueryKey({
      quoteIds: [10n, 9n, 100n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      configKey: "k",
    });

    expect(key[1].quoteIds).toEqual(["9", "10", "100"]);
  });

  it("sorts a copy so the caller's quote-id array is never mutated", () => {
    const quoteIds = [7335n, 7334n];
    const key = getQuotesEventsByTypeQueryKey({ quoteIds, types: FUNDING_HISTORY_EVENT_TYPES, configKey: "k" });

    expect(quoteIds).toEqual([7335n, 7334n]);
    expect(key[1].quoteIds).toEqual(["7334", "7335"]);
  });

  it("clones the types array so the caller's input cannot mutate the key", () => {
    const types = [QuoteEventType.ChargeFundingRate];
    const key = getQuotesEventsByTypeQueryKey({ quoteIds: [1n], types, configKey: "k" });

    expect(key[1].types).not.toBe(types);
    expect(key[1].types).toEqual(types);
  });
});

describe("getQuotesEventsByTypeQueryOptions", () => {
  it("is enabled and wires the action when quote ids and types are present", () => {
    const options = getQuotesEventsByTypeQueryOptions(config, {
      quoteIds: [7334n],
      types: FUNDING_HISTORY_EVENT_TYPES,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getQuotesEventsByType");
    expect(options.queryKey[1]).toMatchObject({ quoteIds: ["7334"] });
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled when quoteIds is empty", () => {
    const options = getQuotesEventsByTypeQueryOptions(config, {
      quoteIds: [],
      types: FUNDING_HISTORY_EVENT_TYPES,
    });

    expect(options.enabled).toBe(false);
  });

  it("is disabled when types is empty", () => {
    expect(getQuotesEventsByTypeQueryOptions(config, { quoteIds: [7334n], types: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false", () => {
    const options = getQuotesEventsByTypeQueryOptions(config, {
      quoteIds: [7334n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      query: { enabled: false },
    });

    expect(options.enabled).toBe(false);
  });

  it("carries paging and sort overrides into the key", () => {
    const options = getQuotesEventsByTypeQueryOptions(config, {
      quoteIds: [7334n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(options.queryKey[1]).toMatchObject({ first: 10, skip: 20, orderDirection: "asc" });
  });
});
