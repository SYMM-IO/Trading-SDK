import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getTransferHistory } from "./get-transfer-history";

const EVENTS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.events;
const config = createConfig({ getClient: () => ({}) as PublicClient });

/** Checksummed; the action lowercases them for the subgraph filter. */
const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";
const OTHER = "0x4AF4cd703760C4F018cEF5059a43b2624cdEB038";

/** Outgoing relative to SUB (SUB is the sender). */
const OUT_ROW = {
  id: "0xtx-out-1",
  sender: SUB.toLowerCase(),
  user: OTHER.toLowerCase(),
  amount: "600431998398848000",
  blockTimestamp: "1781100000",
  transactionHash: "0xout",
};

/** Incoming relative to SUB (SUB is the recipient). */
const IN_ROW = {
  id: "0xtx-in-1",
  sender: OTHER.toLowerCase(),
  user: SUB.toLowerCase(),
  amount: "100000000000000000",
  blockTimestamp: "1781000000",
  transactionHash: "0xin",
};

describe("getTransferHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns [] and skips the network when no accounts are passed", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getTransferHistory(config, { accounts: [] })).toEqual({ rows: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts to the EVENTS subgraph and decodes rows with from/to/amount/direction", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { internalTransfers: [OUT_ROW, IN_ROW] } },
    });

    const result = await getTransferHistory(config, { accounts: [SUB], first: 10, skip: 5 });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]! as [string, { query: string; variables: Record<string, unknown> }];
    expect(url).toBe(EVENTS_URL);
    expect(body.query).toContain("TransferHistory");
    expect(body.variables).toEqual({
      senders: [SUB.toLowerCase()],
      users: [SUB.toLowerCase()],
      first: 10,
      skip: 5,
      orderDirection: "desc",
      startDate: "0",
      endDate: "2000000000",
    });

    expect(result.rows).toEqual([
      {
        id: "0xtx-out-1",
        from: getAddress(SUB),
        to: getAddress(OTHER),
        amount: 600431998398848000n,
        timestamp: 1781100000,
        transaction: "0xout",
        direction: "outgoing",
      },
      {
        id: "0xtx-in-1",
        from: getAddress(OTHER),
        to: getAddress(SUB),
        amount: 100000000000000000n,
        timestamp: 1781000000,
        transaction: "0xin",
        direction: "incoming",
      },
    ]);
  });

  it("maps direction to the sender_in / user_in filter halves", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { internalTransfers: [] } } });

    await getTransferHistory(config, { accounts: [SUB], direction: "outgoing" });
    await getTransferHistory(config, { accounts: [SUB], direction: "incoming" });

    const vars = (call: number) =>
      (post.mock.calls[call]![1] as { variables: { senders: string[]; users: string[] } }).variables;
    expect(vars(0)).toMatchObject({ senders: [SUB.toLowerCase()], users: [] });
    expect(vars(1)).toMatchObject({ senders: [], users: [SUB.toLowerCase()] });
  });
});
