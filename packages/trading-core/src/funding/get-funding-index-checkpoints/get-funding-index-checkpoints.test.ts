import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getFundingIndexCheckpoints } from "./get-funding-index-checkpoints";

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
  id: "cp-1",
  source: DIAMOND.toLowerCase(),
  symbolId: "149",
  partyB: ACCOUNT.toLowerCase(),
  eventType: "SET_FUNDING_RATE",
  rawLongRate: "11",
  rawShortRate: "-11",
  marketPrice: "2",
  currentLongRate: "22",
  currentShortRate: "-22",
  accumulatedLongRate: "1000",
  accumulatedShortRate: "-1000",
  epochDuration: "28800",
  lastUpdatedEpoch: "5",
  startEpoch: "1",
  startEpochTimestamp: "1781000000",
  snapshotLongFee: "3",
  snapshotShortFee: "4",
  timestamp: "1782000000",
  blockNumber: "999",
  transaction: "0xcp",
};

describe("getFundingIndexCheckpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an empty where and the paging defaults when no filter is passed", async () => {
    const post = mockEntities("fundingIndexCheckpoints", []);

    const page = await getFundingIndexCheckpoints(config);

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);
    const body = requestBody(post);
    expect(body.query).toContain("FundingIndexCheckpoints");
    expect(body.variables.where).toEqual({});
    expect(body.variables).toMatchObject({ first: 1000, skip: 0, orderDirection: "desc" });
    expect(page).toEqual({ rows: [], hasMore: false });
  });

  it("puts each passed filter in where, lowercased, and leaves the omitted ones out", async () => {
    const post = mockEntities("fundingIndexCheckpoints", []);

    await getFundingIndexCheckpoints(config, {
      source: DIAMOND,
      marketIds: [149],
      partyBs: [ACCOUNT],
      startTime: 5,
      endTime: 99,
    });

    expect(requestBody(post).variables.where).toEqual({
      source: DIAMOND.toLowerCase(),
      symbolId_in: ["149"],
      partyB_in: [ACCOUNT.toLowerCase()],
      timestamp_gte: "5",
      timestamp_lte: "99",
    });
  });

  it("pages by cursor: orderBy id ascending with an id_gt filter", async () => {
    const post = mockEntities("fundingIndexCheckpoints", []);

    await getFundingIndexCheckpoints(config, {
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
    ["marketIds", { marketIds: [] }],
    ["partyBs", { partyBs: [] }],
  ] as const)("returns an empty page without a request when %s is an empty array", async (_name, filters) => {
    const post = vi.spyOn(axios, "post");

    expect(await getFundingIndexCheckpoints(config, filters)).toEqual({ rows: [], hasMore: false });
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a page size outside 1–1000", async () => {
    const post = vi.spyOn(axios, "post");

    await expect(getFundingIndexCheckpoints(config, { first: 1001 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    await expect(getFundingIndexCheckpoints(config, { first: 0 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("decodes rows and reports a full page as hasMore", async () => {
    mockEntities("fundingIndexCheckpoints", [RAW]);

    const page = await getFundingIndexCheckpoints(config, { first: 1 });

    expect(page.hasMore).toBe(true);
    const row = page.rows[0]!;
    expect(row).toMatchObject({
      source: DIAMOND,
      symbolId: 149,
      partyB: ACCOUNT,
      eventType: "SET_FUNDING_RATE",
      rawLongRate: 11n,
      rawShortRate: -11n,
      currentLongRate: 22n,
      accumulatedShortRate: -1000n,
      epochDuration: 28800n,
      startEpochTimestamp: 1781000000,
      snapshotShortFee: 4n,
      timestamp: 1782000000,
      transaction: "0xcp",
    });
  });

  it("keeps fields the subgraph has not indexed as null, not zero", async () => {
    mockEntities("fundingIndexCheckpoints", [
      { ...RAW, currentLongRate: null, marketPrice: null, epochDuration: null, startEpochTimestamp: null },
    ]);

    const { rows } = await getFundingIndexCheckpoints(config);

    const row = rows[0]!;
    // A consumer falls back from the current rate to raw × market price, so null must stay null.
    expect(row.currentLongRate).toBeNull();
    expect(row.marketPrice).toBeNull();
    expect(row.epochDuration).toBeNull();
    expect(row.startEpochTimestamp).toBeNull();
    expect(row.rawLongRate).toBe(11n);
  });

  it("reads the latest checkpoint at or before a moment with endTime, newest first, first: 1", async () => {
    const post = mockEntities("fundingIndexCheckpoints", []);

    await getFundingIndexCheckpoints(config, {
      marketIds: [149],
      endTime: 1782000000,
      orderDirection: "desc",
      first: 1,
    });

    expect(requestBody(post).variables).toMatchObject({
      where: { symbolId_in: ["149"], timestamp_lte: "1782000000" },
      orderBy: "timestamp",
      orderDirection: "desc",
      first: 1,
    });
  });
});
