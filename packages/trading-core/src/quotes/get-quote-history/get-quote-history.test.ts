import axios from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { getQuoteHistory } from "./get-quote-history";
import { QuoteCloseType } from "./types";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
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
    subAccount: { id: SUB.toLowerCase() },
  },
};

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
      typeIn: ["LIQUIDATE_PARTY_A", "LIQUIDATE_PARTY_B", "LIQUIDATE_CLEARING_HOUSE"],
      subAccounts: [SUB.toLowerCase()],
      first: 10,
      skip: 20,
      orderDirection: "asc",
      startDate: "5",
      endDate: "99",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.quoteId).toBe(8232n);
    expect(result.rows[0]!.closedAmount).toBe(1000000000000000000n);
  });

  it("defaults closeType to All, orderDirection to desc, and first to 50", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });
    await getQuoteHistory(config, { subAccounts: [SUB] });

    const { variables } = post.mock.calls[0]![1] as {
      variables: { typeIn: string[]; orderDirection: string; first: number; startDate: string; endDate: string };
    };
    expect(variables.typeIn).toHaveLength(7);
    expect(variables.orderDirection).toBe("desc");
    expect(variables.first).toBe(50);
    expect(variables.startDate).toBe("0");
    expect(variables.endDate).toBe("2000000000");
  });

  it("filters by the quote's subAccount for VA isolation (default and MARKET / MARKET_DIRECTION)", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getQuoteHistory(config, { subAccounts: [SUB] });
    await getQuoteHistory(config, { subAccounts: [SUB], isolationType: SubAccountIsolationType.MARKET_DIRECTION });

    for (const call of post.mock.calls) {
      const { query } = call[1] as { query: string };
      expect(query).toContain("subAccount_in");
      expect(query).not.toContain("partyA_in");
    }
  });

  it("filters by partyA for cross-margin (CUSTOM) subaccounts, whose quotes carry no subAccount", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [EVENT] } } });

    const result = await getQuoteHistory(config, { subAccounts: [SUB], isolationType: SubAccountIsolationType.CUSTOM });

    const { query, variables } = post.mock.calls[0]![1] as { query: string; variables: Record<string, unknown> };
    expect(query).toContain("partyA_in");
    expect(query).not.toContain("subAccount_in");
    // Still feeds the same `$subAccounts` variable and decodes with the same result shape.
    expect(variables.subAccounts).toEqual([SUB.toLowerCase()]);
    expect(result.rows).toHaveLength(1);
  });
});
