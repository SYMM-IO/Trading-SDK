import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { getQuoteHistory } from "./get-quote-history";
import { QuoteCloseType } from "./types";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

/** Checksummed; the action lowercases it for the subgraph filter. */
const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

const EVENT = {
  id: "0xevent-1",
  type: "FILL_CLOSE",
  metadata: JSON.stringify({ amount: "1000000000000000000", closePrice: "2000000000000000000" }),
  timestamp: "1782000000",
  quoteId: "8232",
  blockNumber: "1",
  transaction: "0xdead",
  source: "0x8a0ed5b4cec4b0c4e1f7c8d9e3a2b1f0c9d8e7f6",
  quote: {
    quoteId: "8232",
    quoteStatus: 7,
    positionType: 0,
    orderTypeOpen: 1,
    symbol: "X",
    symbolId: "149",
    partyA: SUB.toLowerCase(),
    partyB: null,
    quantity: "1",
    openedPrice: "1",
    requestedOpenPrice: "1",
    averageClosedPrice: "2",
    closePrice: "0",
    closedAmount: "1",
    quantityToClose: "0",
    liquidateAmount: null,
    liquidatePrice: null,
    subAccount: { id: SUB.toLowerCase(), owner: SUB.toLowerCase() },
    closedPrice: null,
    initialOpenedPrice: "1",
    marketPrice: null,
    tradingFee: "0",
    closeFee: "0",
    leverage: null,
    cva: null,
    lf: null,
    initialCva: "0",
    initialLf: "0",
    initialPartyAmm: null,
    timestampSendQuote: "1781999000",
    timestampOpenPosition: null,
    sendQuoteEvents: [{ transaction: "0xopen" }],
    openPositionEvents: [],
  },
};

/** Checksummed diamond; the action lowercases it for the `source` filter. */
const DIAMOND = getAddress("0x8a0ed5b4cec4b0c4e1f7c8d9e3a2b1f0c9d8e7f6");

interface HistoryRequestBody {
  query: string;
  variables: {
    where: Record<string, unknown> & { quote_?: Record<string, unknown> };
    first: number;
    skip: number;
    orderDirection: string;
  };
}

function requestBody(call: unknown[]): HistoryRequestBody {
  return call[1] as HistoryRequestBody;
}

describe("getQuoteHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns [] and skips the network when no subAccounts are passed", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getQuoteHistory(config, { subAccounts: [] })).toEqual({ rows: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the history query with mapped variables and returns decoded rows", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [EVENT] } } });

    const result = await getQuoteHistory(config, {
      subAccounts: [SUB],
      closeType: QuoteCloseType.Liquidated,
      first: 10,
      skip: 20,
      startTime: 5,
      endTime: 99,
      orderDirection: "asc",
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]! as [string, { query: string; variables: Record<string, unknown> }];
    expect(url).toBe(ANALYTICS_URL);
    expect(body.query).toContain("QuoteEventsForHistory");
    expect(body.variables).toEqual({
      where: {
        type_in: ["LIQUIDATE_PARTY_A", "LIQUIDATE_PARTY_B", "LIQUIDATE_CLEARING_HOUSE"],
        timestamp_gte: "5",
        timestamp_lte: "99",
        quote_: { subAccount_in: [SUB.toLowerCase()] },
      },
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.quoteId).toBe(8232n);
    expect(result.rows[0]!.closedAmount).toBe(1000000000000000000n);
  });

  it("defaults closeType to All, orderDirection to desc, and first to 50", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });
    await getQuoteHistory(config, { subAccounts: [SUB] });

    const { variables } = requestBody(post.mock.calls[0]!);
    expect(variables.where.type_in).toHaveLength(7);
    expect(variables.orderDirection).toBe("desc");
    expect(variables.first).toBe(50);
    expect(variables.where.timestamp_gte).toBe("0");
    expect(variables.where.timestamp_lte).toBe("2000000000");
  });

  it("filters by the quote's subAccount for VA isolation (default and MARKET / MARKET_DIRECTION)", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getQuoteHistory(config, { subAccounts: [SUB] });
    await getQuoteHistory(config, { subAccounts: [SUB], isolationType: SubAccountIsolationType.MARKET_DIRECTION });

    for (const call of post.mock.calls) {
      expect(requestBody(call).variables.where.quote_).toEqual({ subAccount_in: [SUB.toLowerCase()] });
    }
  });

  it("filters by partyA for cross-margin (CUSTOM) subaccounts, whose quotes carry no subAccount", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [EVENT] } } });

    const result = await getQuoteHistory(config, { subAccounts: [SUB], isolationType: SubAccountIsolationType.CUSTOM });

    expect(requestBody(post.mock.calls[0]!).variables.where.quote_).toEqual({ partyA_in: [SUB.toLowerCase()] });
    expect(result.rows).toHaveLength(1);
  });

  it("adds the deployment and market filters on the quote only when passed", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getQuoteHistory(config, { subAccounts: [SUB], source: DIAMOND, marketIds: [149, 150] });

    expect(requestBody(post.mock.calls[0]!).variables.where.quote_).toEqual({
      subAccount_in: [SUB.toLowerCase()],
      source: DIAMOND.toLowerCase(),
      symbolId_in: ["149", "150"],
    });
  });

  it("sends no quote filter at all when no account, deployment or market is passed", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getQuoteHistory(config, {});

    const { where } = requestBody(post.mock.calls[0]!).variables;
    // Graph-node rejects a null filter, so an omitted one must be absent, not empty.
    expect(where).not.toHaveProperty("quote_");
    expect(Object.values(where)).not.toContain(undefined);
  });

  it("returns [] and skips the network when marketIds is an empty array", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getQuoteHistory(config, { subAccounts: [SUB], marketIds: [] })).toEqual({ rows: [] });
    expect(post).not.toHaveBeenCalled();
  });
});
