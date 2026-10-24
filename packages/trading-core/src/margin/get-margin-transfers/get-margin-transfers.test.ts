import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarginTransferType } from "../../balance-history/get-balance-history/types";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getMarginTransfers } from "./get-margin-transfers";

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
  id: "0xtx-1",
  type: "ADD",
  amount: "1250000000000000000",
  source: DIAMOND.toLowerCase(),
  timestamp: "1782000000",
  blockNumber: "777",
  transaction: "0xopen",
  virtualAccount: { id: ACCOUNT.toLowerCase() },
  subAccount: { id: ACCOUNT.toLowerCase() },
};

describe("getMarginTransfers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an empty where and the paging defaults when no filter is passed", async () => {
    const post = mockEntities("marginTransfers", []);

    const page = await getMarginTransfers(config);

    expect(post).toHaveBeenCalledTimes(1);
    const [url] = post.mock.calls[0] as unknown as [string];
    expect(url).toBe(ANALYTICS_URL);
    const body = requestBody(post);
    expect(body.query).toContain("MarginTransfers");
    expect(body.variables.where).toEqual({});
    expect(body.variables).toMatchObject({ first: 1000, skip: 0, orderDirection: "desc" });
    expect(page).toEqual({ rows: [], hasMore: false });
  });

  it("puts each passed filter in where, lowercased, and leaves the omitted ones out", async () => {
    const post = mockEntities("marginTransfers", []);

    await getMarginTransfers(config, {
      source: DIAMOND,
      types: [MarginTransferType.Add],
      transactions: ["0xABC"],
      virtualAccounts: [ACCOUNT],
      startTime: 5,
      endTime: 99,
    });

    expect(requestBody(post).variables.where).toEqual({
      source: DIAMOND.toLowerCase(),
      type_in: ["ADD"],
      transaction_in: ["0xabc"],
      virtualAccount_in: [ACCOUNT.toLowerCase()],
      timestamp_gte: "5",
      timestamp_lte: "99",
    });
  });

  it("pages by cursor: orderBy id ascending with an id_gt filter", async () => {
    const post = mockEntities("marginTransfers", []);

    await getMarginTransfers(config, { orderBy: "id", orderDirection: "asc", idGt: "cursor-1", first: 500, skip: 0 });

    expect(requestBody(post).variables).toMatchObject({
      where: { id_gt: "cursor-1" },
      orderBy: "id",
      orderDirection: "asc",
      first: 500,
    });
  });

  it.each([
    ["types", { types: [] }],
    ["transactions", { transactions: [] }],
    ["virtualAccounts", { virtualAccounts: [] }],
    ["subAccounts", { subAccounts: [] }],
  ] as const)("returns an empty page without a request when %s is an empty array", async (_name, filters) => {
    const post = vi.spyOn(axios, "post");

    expect(await getMarginTransfers(config, filters)).toEqual({ rows: [], hasMore: false });
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a page size outside 1–1000", async () => {
    const post = vi.spyOn(axios, "post");

    await expect(getMarginTransfers(config, { first: 1001 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    await expect(getMarginTransfers(config, { first: 0 })).rejects.toMatchObject({
      code: "INVALID_SUBGRAPH_PAGE_SIZE",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("decodes rows and reports a full page as hasMore", async () => {
    mockEntities("marginTransfers", [RAW]);

    const page = await getMarginTransfers(config, { first: 1 });

    expect(page.hasMore).toBe(true);
    const row = page.rows[0]!;
    expect(row).toEqual({
      id: "0xtx-1",
      type: MarginTransferType.Add,
      virtualAccount: ACCOUNT,
      subAccount: ACCOUNT,
      amount: 1250000000000000000n,
      source: DIAMOND,
      timestamp: 1782000000,
      blockNumber: 777n,
      transaction: "0xopen",
    });
  });

  it("keeps fields the subgraph has not indexed as null, not zero", async () => {
    mockEntities("marginTransfers", [{ ...RAW, type: "EMERGENCY_RECOVER" }]);

    const { rows } = await getMarginTransfers(config);

    const row = rows[0]!;
    // Every MarginTransfer field is non-null in the schema; an unlisted type passes through.
    expect(row.type).toBe("EMERGENCY_RECOVER");
  });
});
