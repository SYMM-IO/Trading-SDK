import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { getSubgraphQuotes } from "./get-subgraph-quotes";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

/** Checksummed; the actions lowercase addresses for the subgraph filter. */
const DIAMOND = getAddress("0x8a0ed5b4cec4b0c4e1f7c8d9e3a2b1f0c9d8e7f6");
const ACCOUNT = getAddress("0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a");

interface RequestBody {
  query: string;
  variables: { where: Record<string, unknown>; first: number; skip: number; orderBy: string; orderDirection: string };
}

function requestBody(post: ReturnType<typeof vi.spyOn>, index = 0): RequestBody {
  return (post.mock.calls[index] as unknown as [string, RequestBody])[1];
}

function mockEntities(collection: string, rows: unknown[]) {
  return vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { [collection]: rows } } });
}

const RAW = {
  id: "7334-0x8a0ed5b4cec4b0c4e1f7c8d9e3a2b1f0c9d8e7f6",
  source: DIAMOND.toLowerCase(),
  quoteId: "7334",
  quoteStatus: 7,
  partyA: ACCOUNT.toLowerCase(),
  partyB: ACCOUNT.toLowerCase(),
  symbolId: "149",
  symbol: "SYMM",
  positionType: 1,
  quantity: "30",
  fillAmount: "30",
  closedAmount: "30",
  openedPrice: "2",
  accumulatedPaidFunding: "-15",
  lastFundingPaymentTimestamp: "1782000000",
  userPaidFunding: "4",
  userReceivedFunding: "1",
  timestampSendQuote: "1781990000",
  timestampOpenPosition: "1781990004",
  timestampFullyClose: "1782000100",
  timestamp: "1782000100",
  blockNumber: "999",
};

describe("getSubgraphQuotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an empty where and the paging defaults when no filter is passed", async () => {
    const post = mockEntities("quotes", []);

    const page = await getSubgraphQuotes(config);

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);
    const body = requestBody(post);
    expect(body.query).toContain("SubgraphQuotes");
    expect(body.variables.where).toEqual({});
    expect(body.variables).toMatchObject({ first: 1000, skip: 0, orderDirection: "desc" });
    expect(page).toEqual({ rows: [], hasMore: false });
  });

  it("puts each passed filter in where, lowercased, and leaves the omitted ones out", async () => {
    const post = mockEntities("quotes", []);

    await getSubgraphQuotes(config, { quoteIds: [7334n, 7335n], source: DIAMOND, partyAs: [ACCOUNT] });

    expect(requestBody(post).variables.where).toEqual({
      quoteId_in: ["7334", "7335"],
      source: DIAMOND.toLowerCase(),
      partyA_in: [ACCOUNT.toLowerCase()],
    });
  });

  it("pages by cursor: orderBy id ascending with an id_gt filter", async () => {
    const post = mockEntities("quotes", []);

    await getSubgraphQuotes(config, { orderBy: "id", orderDirection: "asc", idGt: "cursor-1", first: 500, skip: 0 });

    expect(requestBody(post).variables).toMatchObject({
      where: { id_gt: "cursor-1" },
      orderBy: "id",
      orderDirection: "asc",
      first: 500,
    });
  });

  it.each([
    ["quoteIds", { quoteIds: [] }],
    ["partyAs", { partyAs: [] }],
  ] as const)("returns an empty page without a request when %s is an empty array", async (_name, filters) => {
    const post = vi.spyOn(axios, "post");

    expect(await getSubgraphQuotes(config, filters)).toEqual({ rows: [], hasMore: false });
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a page size outside 1–1000", async () => {
    const post = vi.spyOn(axios, "post");

    await expect(getSubgraphQuotes(config, { first: 1001 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    await expect(getSubgraphQuotes(config, { first: 0 })).rejects.toMatchObject({ code: "INVALID_SUBGRAPH_PAGE_SIZE" });
    expect(post).not.toHaveBeenCalled();
  });

  it("decodes rows and reports a full page as hasMore", async () => {
    mockEntities("quotes", [RAW]);

    const page = await getSubgraphQuotes(config, { first: 1 });

    expect(page.hasMore).toBe(true);
    const row = page.rows[0]!;
    expect(row).toMatchObject({
      source: DIAMOND,
      quoteId: 7334n,
      quoteStatus: QuoteStatus.CLOSED,
      partyA: ACCOUNT,
      symbolId: 149,
      positionType: PositionType.SHORT,
      quantity: 30n,
      openedPrice: 2n,
      // Signed index, kept as indexed.
      accumulatedPaidFunding: -15n,
      lastFundingPaymentTimestamp: 1782000000,
      userPaidFunding: 4n,
      userReceivedFunding: 1n,
      timestampFullyClose: 1782000100,
      blockNumber: 999n,
    });
  });

  it("keeps fields the subgraph has not indexed as null, not zero", async () => {
    mockEntities("quotes", [
      {
        ...RAW,
        partyB: null,
        quoteStatus: null,
        positionType: null,
        symbolId: null,
        fillAmount: null,
        timestampFullyClose: null,
      },
    ]);

    const { rows } = await getSubgraphQuotes(config);

    const row = rows[0]!;
    expect(row.partyB).toBeNull();
    expect(row.quoteStatus).toBeNull();
    expect(row.positionType).toBeNull();
    expect(row.symbolId).toBeNull();
    expect(row.fillAmount).toBeNull();
    expect(row.timestampFullyClose).toBeNull();
  });
});
