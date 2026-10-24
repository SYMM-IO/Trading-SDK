import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getLiquidationDetails } from "./get-liquidation-details";

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
  id: "liq-1",
  source: DIAMOND.toLowerCase(),
  partyA: ACCOUNT.toLowerCase(),
  liquidationId: "12",
  liquidationType: 1,
  liquidationTimestamp: "1782000000",
  timestamp: "1782000005",
  lockedCva: "100",
  lockedLf: "50",
  lockedPartyAmm: "400",
  paidCva: "90",
  paidLf: "40",
  upnl: "-1000",
  deficit: "0",
  liquidationFee: "3",
  settled: true,
  fullyLiquidated: false,
  settlementExpectedAmounts: ["7", "8"],
  settlementActualAmounts: ["6", "8"],
};

describe("getLiquidationDetails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an empty where and the paging defaults when no filter is passed", async () => {
    const post = mockEntities("liquidationDetails", []);

    const page = await getLiquidationDetails(config);

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);
    const body = requestBody(post);
    expect(body.query).toContain("LiquidationDetails");
    expect(body.variables.where).toEqual({});
    expect(body.variables).toMatchObject({ first: 1000, skip: 0, orderDirection: "desc" });
    expect(page).toEqual({ rows: [], hasMore: false });
  });

  it("puts each passed filter in where, lowercased, and leaves the omitted ones out", async () => {
    const post = mockEntities("liquidationDetails", []);

    await getLiquidationDetails(config, { source: DIAMOND, partyAs: [ACCOUNT], startTime: 5, endTime: 99 });

    expect(requestBody(post).variables.where).toEqual({
      source: DIAMOND.toLowerCase(),
      partyA_in: [ACCOUNT.toLowerCase()],
      liquidationTimestamp_gte: "5",
      liquidationTimestamp_lte: "99",
    });
  });

  it("pages by cursor: orderBy id ascending with an id_gt filter", async () => {
    const post = mockEntities("liquidationDetails", []);

    await getLiquidationDetails(config, {
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

  it.each([["partyAs", { partyAs: [] }]] as const)(
    "returns an empty page without a request when %s is an empty array",
    async (_name, filters) => {
      const post = vi.spyOn(axios, "post");

      expect(await getLiquidationDetails(config, filters)).toEqual({ rows: [], hasMore: false });
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("rejects a page size outside 1–1000", async () => {
    const post = vi.spyOn(axios, "post");

    await expect(getLiquidationDetails(config, { first: 1001 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    await expect(getLiquidationDetails(config, { first: 0 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("decodes rows and reports a full page as hasMore", async () => {
    mockEntities("liquidationDetails", [RAW]);

    const page = await getLiquidationDetails(config, { first: 1 });

    expect(page.hasMore).toBe(true);
    const row = page.rows[0]!;
    expect(row).toEqual({
      id: "liq-1",
      source: DIAMOND,
      partyA: ACCOUNT,
      liquidationId: 12n,
      liquidationType: 1,
      liquidationTimestamp: 1782000000,
      timestamp: 1782000005,
      lockedCva: 100n,
      lockedLf: 50n,
      lockedPartyAmm: 400n,
      paidCva: 90n,
      paidLf: 40n,
      upnl: -1000n,
      deficit: 0n,
      liquidationFee: 3n,
      settled: true,
      fullyLiquidated: false,
      settlementExpectedAmounts: [7n, 8n],
      settlementActualAmounts: [6n, 8n],
    });
  });

  it("keeps fields the subgraph has not indexed as null, not zero", async () => {
    mockEntities("liquidationDetails", [
      { ...RAW, timestamp: null, lockedCva: null, paidLf: null, settlementExpectedAmounts: null },
    ]);

    const { rows } = await getLiquidationDetails(config);

    const row = rows[0]!;
    expect(row.timestamp).toBeNull();
    expect(row.lockedCva).toBeNull();
    expect(row.paidLf).toBeNull();
    expect(row.settlementExpectedAmounts).toBeNull();
    expect(row.lockedLf).toBe(50n);
  });

  it("sorts by liquidationTimestamp when orderBy is timestamp", async () => {
    const post = mockEntities("liquidationDetails", []);

    await getLiquidationDetails(config);
    await getLiquidationDetails(config, { orderBy: "id" });

    expect(requestBody(post, 0).variables.orderBy).toBe("liquidationTimestamp");
    expect(requestBody(post, 1).variables.orderBy).toBe("id");
  });
});
