import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { FUNDING_HISTORY_EVENT_TYPES, QuoteEventType } from "../get-quote-events-by-type/types";
import { getQuotesEventsByType } from "./get-quotes-events-by-type";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
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

describe("getQuotesEventsByType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty page and skips the network when no quote ids are requested", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getQuotesEventsByType(config, { quoteIds: [], types: FUNDING_HISTORY_EVENT_TYPES })).toEqual({
      rows: [],
      hasMore: false,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("returns an empty page and skips the network when no types are requested", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getQuotesEventsByType(config, { quoteIds: [7334n], types: [] })).toEqual({
      rows: [],
      hasMore: false,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the batched events query with stringified ids and returns decoded rows", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { quoteEvents: [makeNode(), makeNode({ id: "0xevent-2", quoteId: "7335" })] } },
    });

    const result = await getQuotesEventsByType(config, {
      quoteIds: [7334n, 7335n],
      types: FUNDING_HISTORY_EVENT_TYPES,
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = postArgs(post);
    expect(url).toBe(ANALYTICS_URL);
    expect(body.query).toContain("QuoteEventsForQuotesByType");
    expect(body.variables).toEqual({
      where: {
        quoteId_in: ["7334", "7335"],
        type_in: [QuoteEventType.ChargeFundingRate, QuoteEventType.ChargeAccumulatedFundingFee],
      },
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    /** Rows arrive merged across ids; each keeps its own quoteId. */
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.quoteId)).toEqual([7334n, 7335n]);
    expect(result.rows[0]!.type).toBe(QuoteEventType.ChargeFundingRate);
    expect(result.rows[0]!.fundingPaid).toBe(1500000000000000000n);
  });

  it("preserves the caller's quote-id order in the request without mutating the input", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });
    const quoteIds = [7335n, 7334n];

    await getQuotesEventsByType(config, { quoteIds, types: [QuoteEventType.ChargeFundingRate] });

    expect(quoteIds).toEqual([7335n, 7334n]);
  });

  it("defaults first to the subgraph ceiling, skip to 0, and orderDirection to desc", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getQuotesEventsByType(config, { quoteIds: [7334n], types: [QuoteEventType.ChargeFundingRate] });

    const { variables } = postArgs(post)[1];
    expect(variables.first).toBe(1000);
    expect(variables.skip).toBe(0);
    expect(variables.orderDirection).toBe("desc");
  });

  it("flags hasMore when the page comes back full", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [makeNode()] } } });

    const result = await getQuotesEventsByType(config, {
      quoteIds: [7334n, 7335n],
      types: [QuoteEventType.ChargeFundingRate],
      first: 1,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("clears hasMore when the page is not full", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [makeNode()] } } });

    const result = await getQuotesEventsByType(config, {
      quoteIds: [7334n, 7335n],
      types: [QuoteEventType.ChargeFundingRate],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("reads every event type when types is omitted, and narrows row types to the ones passed", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { quoteEvents: [makeNode({ type: "QUOTE_ADJUSTED", metadata: null })] } },
    });
    const diamond = getAddress("0x8a0ed5b4cec4b0c4e1f7c8d9e3a2b1f0c9d8e7f6");

    const all = await getQuotesEventsByType(config, { quoteIds: [7334n] });
    await getQuotesEventsByType(config, {
      quoteIds: [7334n],
      types: ["FILL_CLOSE", "QUOTE_ADJUSTED"],
      source: diamond,
    });

    const wheres = post.mock.calls.map((call) => (call[1] as { variables: { where: unknown } }).variables.where);
    expect(wheres).toEqual([
      { quoteId_in: ["7334"] },
      { quoteId_in: ["7334"], type_in: ["FILL_CLOSE", "QUOTE_ADJUSTED"], source: diamond.toLowerCase() },
    ]);
    // An unlisted subgraph type passes through untouched, with its raw metadata.
    expect(all.rows[0]!.type).toBe("QUOTE_ADJUSTED");
    expect(all.rows[0]!.rawMetadata).toBeNull();
  });
});
