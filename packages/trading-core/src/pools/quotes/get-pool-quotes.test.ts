import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { mockConfig } from "../../shared/test/mock-config";
import { getPoolQuotes, POOL_OPEN_QUOTE_STATUSES, POOL_PENDING_QUOTE_STATUSES } from "./get-pool-quotes";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const SOURCE = getChainConfig(SymmioSupportedChainId.HYPER_EVM).addresses.symmioAddress.toLowerCase();

const ROW = {
  id: "8232-source",
  quoteId: "8232",
  quoteStatus: 4,
  positionType: 0,
  orderTypeOpen: 1,
  symbol: "SYMM",
  symbolId: "149",
  partyA: "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a",
  partyB: null,
  quantity: "1000000000000000000",
  closedAmount: "0",
  quantityToClose: "0",
  openedPrice: "1",
  requestedOpenPrice: "1",
  averageClosedPrice: "0",
  closePrice: "0",
  initialOpenedPrice: "1",
  liquidateAmount: null,
  liquidatePrice: null,
  timestamp: "1782000000",
  blockNumber: "1",
};

/** The GraphQL body of the axios `post` call at `index`. */
function requestBody(post: ReturnType<typeof vi.spyOn>, index = 0) {
  return (post.mock.calls[index] as unknown as [string, { query: string; variables: Record<string, unknown> }])[1];
}

describe("getPoolQuotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns [] and skips the network for a pool with no solver market", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post");

    await expect(getPoolQuotes(config, { symbolId: null })).resolves.toEqual({ quotes: [] });
    await expect(getPoolQuotes(config, { symbolId: undefined })).resolves.toEqual({ quotes: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it("scopes the query to the market and the lower-cased diamond, with no account filter", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quotes: [ROW] } } });

    const { quotes } = await getPoolQuotes(config, { symbolId: 149 });

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);

    const body = requestBody(post);
    expect(body.query).toContain("PoolQuotes");
    expect(body.query).not.toContain("partyA:");
    expect(body.variables).toEqual({
      symbolId: "149",
      source: SOURCE,
      quoteStatuses: [...POOL_PENDING_QUOTE_STATUSES],
      first: 50,
      skip: 0,
      orderDirection: "desc",
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ quoteId: 8232n, symbolId: 149 });
  });

  it("forwards an explicit status filter, paging and sort", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quotes: [] } } });

    await getPoolQuotes(config, {
      symbolId: 1,
      quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });

    expect(requestBody(post).variables).toMatchObject({
      quoteStatuses: [...POOL_OPEN_QUOTE_STATUSES],
      first: 10,
      skip: 20,
      orderDirection: "asc",
    });
  });

  it("sends the status filter as a plain array the subgraph can serialize", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quotes: [] } } });

    await getPoolQuotes(config, { symbolId: 1, quoteStatuses: POOL_OPEN_QUOTE_STATUSES });

    const { quoteStatuses } = requestBody(post).variables;
    expect(Array.isArray(quoteStatuses)).toBe(true);
    expect(quoteStatuses).not.toBe(POOL_OPEN_QUOTE_STATUSES);
  });

  it("passes symbolId 0 through instead of treating it as absent", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quotes: [] } } });

    await getPoolQuotes(config, { symbolId: 0 });

    expect(requestBody(post).variables).toMatchObject({ symbolId: "0" });
  });
});
