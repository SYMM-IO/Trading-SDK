import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { getQuoteFundingSettlements } from "./get-quote-funding-settlements";

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
  id: "s-1",
  source: DIAMOND.toLowerCase(),
  quoteId: "7334",
  partyA: ACCOUNT.toLowerCase(),
  partyB: ACCOUNT.toLowerCase(),
  symbolId: "149",
  positionType: 0,
  trigger: "CLOSE",
  openAmount: "30",
  signedAmount: "-12",
  paidByPartyA: "12",
  receivedByPartyA: "0",
  previousAccumulatedPaidFunding: "100",
  newAccumulatedPaidFunding: "140",
  fundingDeltaPerUnit: "40",
  previousLastFundingPaymentTimestamp: "1781990000",
  newLastFundingPaymentTimestamp: "1782000000",
  previousPaidThroughEpoch: "10",
  newPaidThroughEpoch: "11",
  balanceChanged: true,
  timestamp: "1782000000",
  blockNumber: "999",
  transaction: "0xsettle",
};

describe("getQuoteFundingSettlements", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an empty where and the paging defaults when no filter is passed", async () => {
    const post = mockEntities("quoteFundingSettlements", []);

    const page = await getQuoteFundingSettlements(config);

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);
    const body = requestBody(post);
    expect(body.query).toContain("QuoteFundingSettlements");
    expect(body.variables.where).toEqual({});
    expect(body.variables).toMatchObject({ first: 1000, skip: 0, orderDirection: "desc" });
    expect(page).toEqual({ rows: [], hasMore: false });
  });

  it("puts each passed filter in where, lowercased, and leaves the omitted ones out", async () => {
    const post = mockEntities("quoteFundingSettlements", []);

    await getQuoteFundingSettlements(config, {
      quoteIds: [7334n],
      source: DIAMOND,
      partyAs: [ACCOUNT],
      startTime: 5,
      endTime: 99,
    });

    expect(requestBody(post).variables.where).toEqual({
      quoteId_in: ["7334"],
      source: DIAMOND.toLowerCase(),
      partyA_in: [ACCOUNT.toLowerCase()],
      timestamp_gte: "5",
      timestamp_lte: "99",
    });
  });

  it("pages by cursor: orderBy id ascending with an id_gt filter", async () => {
    const post = mockEntities("quoteFundingSettlements", []);

    await getQuoteFundingSettlements(config, {
      orderBy: "id",
      orderDirection: "asc",
      idGt: "cursor-1",
      first: 500,
      skip: 0,
    });

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

    expect(await getQuoteFundingSettlements(config, filters)).toEqual({ rows: [], hasMore: false });
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a page size outside 1–1000", async () => {
    const post = vi.spyOn(axios, "post");

    await expect(getQuoteFundingSettlements(config, { first: 1001 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    await expect(getQuoteFundingSettlements(config, { first: 0 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("decodes rows and reports a full page as hasMore", async () => {
    mockEntities("quoteFundingSettlements", [RAW]);

    const page = await getQuoteFundingSettlements(config, { first: 1 });

    expect(page.hasMore).toBe(true);
    const row = page.rows[0]!;
    expect(row).toMatchObject({
      source: DIAMOND,
      quoteId: 7334n,
      partyA: ACCOUNT,
      symbolId: 149,
      positionType: PositionType.LONG,
      trigger: "CLOSE",
      openAmount: 30n,
      // The subgraph's sign, never re-signed.
      signedAmount: -12n,
      paidByPartyA: 12n,
      fundingDeltaPerUnit: 40n,
      previousLastFundingPaymentTimestamp: 1781990000,
      newPaidThroughEpoch: 11n,
      balanceChanged: true,
      transaction: "0xsettle",
    });
  });

  it("keeps fields the subgraph has not indexed as null, not zero", async () => {
    mockEntities("quoteFundingSettlements", [{ ...RAW, previousPaidThroughEpoch: null, newPaidThroughEpoch: null }]);

    const { rows } = await getQuoteFundingSettlements(config);

    const row = rows[0]!;
    expect(row.previousPaidThroughEpoch).toBeNull();
    expect(row.newPaidThroughEpoch).toBeNull();
  });
});
