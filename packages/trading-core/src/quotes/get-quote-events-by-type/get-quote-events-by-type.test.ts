import axios from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE, getQuoteEventsByType } from "./get-quote-events-by-type";
import { PRICE_HISTORY_EVENT_TYPES, QuoteEventType } from "./types";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

function makeNode(overrides?: Record<string, unknown>) {
  return {
    id: "0xevent-1",
    type: QuoteEventType.ChargeFundingRate,
    metadata: JSON.stringify({ fundingPaid: "1500000000000000000", rate: "250000000000000" }),
    timestamp: "1782000000",
    blockNumber: "12345",
    transaction: "0xabc",
    quoteId: "7334",
    ...overrides,
  };
}

/** Extract the `[url, body]` of the single axios.post call. */
function postArgs(post: ReturnType<typeof vi.spyOn>) {
  return post.mock.calls[0]! as unknown as [string, { query: string; variables: Record<string, unknown> }];
}

describe("getQuoteEventsByType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty page and skips the network when no types are requested", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getQuoteEventsByType(config, { quoteId: 7334n, types: [] })).toEqual({ rows: [], hasMore: false });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the events query with mapped variables and returns decoded rows", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [makeNode()] } } });

    const result = await getQuoteEventsByType(config, {
      quoteId: 7334n,
      types: PRICE_HISTORY_EVENT_TYPES,
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = postArgs(post);
    expect(url).toBe(ANALYTICS_URL);
    expect(body.query).toContain("QuoteEventsForQuoteByType");
    expect(body.variables).toEqual({
      quoteId: "7334",
      typeIn: [QuoteEventType.SettleUpnl, QuoteEventType.ChargeFundingRate, QuoteEventType.ChargeAccumulatedFundingFee],
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.quoteId).toBe(7334n);
    expect(result.rows[0]!.type).toBe(QuoteEventType.ChargeFundingRate);
    expect(result.rows[0]!.fundingPaid).toBe(1500000000000000000n);
  });

  it("defaults first to 50, skip to 0, and orderDirection to desc", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getQuoteEventsByType(config, { quoteId: 7334n, types: [QuoteEventType.ChargeFundingRate] });

    const { variables } = postArgs(post)[1];
    expect(variables.first).toBe(DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE);
    expect(variables.first).toBe(50);
    expect(variables.skip).toBe(0);
    expect(variables.orderDirection).toBe("desc");
  });

  it("flags hasMore when the page comes back full", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [makeNode()] } } });

    const result = await getQuoteEventsByType(config, {
      quoteId: 7334n,
      types: [QuoteEventType.ChargeFundingRate],
      first: 1,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("clears hasMore when the page is not full", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [makeNode()] } } });

    const result = await getQuoteEventsByType(config, {
      quoteId: 7334n,
      types: [QuoteEventType.ChargeFundingRate],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });
});
