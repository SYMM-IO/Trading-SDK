import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { QuoteCloseType } from "../../quotes/get-quote-history/types";
import { mockConfig } from "../../shared/test/mock-config";
import { getPoolTradeHistory } from "./get-pool-trade-history";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const SOURCE = getChainConfig(SymmioSupportedChainId.HYPER_EVM).addresses.symmioAddress.toLowerCase();
const SUB = "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a";

/** One close event carrying the frozen snapshot the mapper overlays. */
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
    symbol: "SYMM",
    symbolId: "149",
    partyA: SUB,
    partyB: null,
    quantity: "2000000000000000000",
    openedPrice: "1",
    requestedOpenPrice: "1",
    averageClosedPrice: "2",
    closePrice: "0",
    closedAmount: "2000000000000000000",
    quantityToClose: "0",
    liquidateAmount: null,
    liquidatePrice: null,
    subAccount: { id: SUB },
  },
};

/** The GraphQL body of the axios `post` call at `index`. */
function requestBody(post: ReturnType<typeof vi.spyOn>, index = 0) {
  return (post.mock.calls[index] as unknown as [string, { query: string; variables: Record<string, unknown> }])[1];
}

describe("getPoolTradeHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns [] and skips the network for a pool with no solver market", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post");

    await expect(getPoolTradeHistory(config, { symbolId: null })).resolves.toEqual({ rows: [] });
    await expect(getPoolTradeHistory(config, { symbolId: undefined })).resolves.toEqual({ rows: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it("scopes to the market and the lower-cased diamond with no account clause, and decodes rows", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [EVENT] } } });

    const { rows } = await getPoolTradeHistory(config, { symbolId: 149 });

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);

    const body = requestBody(post);
    expect(body.query).toContain("PoolQuoteEvents");
    expect(body.query).not.toContain("subAccount_in");
    expect(body.query).not.toContain("partyA_in");
    expect(body.variables).toMatchObject({ symbolId: "149", source: SOURCE });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.quoteId).toBe(8232n);
    /** The event's own snapshot, not the quote's final `closedAmount`. */
    expect(rows[0]!.closedAmount).toBe(1000000000000000000n);
  });

  it("defaults closeType to All, first to 50, skip to 0 and orderDirection to desc", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getPoolTradeHistory(config, { symbolId: 149 });

    const { variables } = requestBody(post) as unknown as { variables: { typeIn: string[]; [k: string]: unknown } };
    expect(variables.typeIn).toHaveLength(7);
    expect(variables).toMatchObject({ first: 50, skip: 0, orderDirection: "desc" });
  });

  it("maps a close-type filter to its event types", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: [] } } });

    await getPoolTradeHistory(config, {
      symbolId: 149,
      closeType: QuoteCloseType.Liquidated,
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(requestBody(post).variables).toMatchObject({
      typeIn: ["LIQUIDATE_PARTY_A", "LIQUIDATE_PARTY_B", "LIQUIDATE_CLEARING_HOUSE"],
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });
  });

  it("reads a missing quoteEvents collection as an empty page", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: null } } });

    await expect(getPoolTradeHistory(config, { symbolId: 149 })).resolves.toEqual({ rows: [] });
  });
});
