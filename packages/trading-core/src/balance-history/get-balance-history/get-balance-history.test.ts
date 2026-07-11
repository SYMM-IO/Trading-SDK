import axios from "axios";
import { getAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getBalanceHistory } from "./get-balance-history";
import { BalanceChangeType, BalanceHistoryFilter } from "./types";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

/** Checksummed; the action lowercases it for the subgraph filter. */
const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

const DEPOSIT_ROW = {
  id: "0xabc-20",
  type: "DEPOSIT",
  amount: "9964904",
  account: SUB.toLowerCase(),
  timestamp: "1781105589",
  transaction: "0xabc",
  isMarginTransferSideEffect: false,
  marginTransferType: null,
};

describe("getBalanceHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns [] and skips the network when no accounts are passed", async () => {
    const post = vi.spyOn(axios, "post");
    expect(await getBalanceHistory(config, { accounts: [] })).toEqual({ rows: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the balance-changes query with mapped variables and returns decoded rows", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { balanceChanges: [DEPOSIT_ROW] } } });

    const result = await getBalanceHistory(config, {
      accounts: [SUB],
      filter: BalanceHistoryFilter.Withdraw,
      first: 10,
      skip: 20,
      startTime: 5,
      endTime: 99,
      orderDirection: "asc",
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]! as [string, { query: string; variables: Record<string, unknown> }];
    expect(url).toBe(ANALYTICS_URL);
    expect(body.query).toContain("BalanceChanges");
    expect(body.variables).toEqual({
      accounts: [SUB.toLowerCase()],
      typeIn: ["WITHDRAW", "BRIDGE"],
      isMarginTransferSideEffectIn: [false],
      first: 10,
      skip: 20,
      orderDirection: "asc",
      startDate: "5",
      endDate: "99",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!).toMatchObject({
      id: "0xabc-20",
      type: BalanceChangeType.Deposit,
      amount: 9964904n,
      account: getAddress(SUB),
      timestamp: 1781105589,
      transaction: "0xabc",
      isInternalTransfer: false,
      marginTransferType: null,
    });
  });

  it("maps the internalTransfers mode to the isMarginTransferSideEffect filter list", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { balanceChanges: [] } } });

    await getBalanceHistory(config, { accounts: [SUB], internalTransfers: "only" });
    await getBalanceHistory(config, { accounts: [SUB], internalTransfers: "include" });

    const sideEffectIn = (call: number) =>
      (post.mock.calls[call]![1] as { variables: { isMarginTransferSideEffectIn: boolean[] } }).variables
        .isMarginTransferSideEffectIn;
    expect(sideEffectIn(0)).toEqual([true]);
    expect(sideEffectIn(1)).toEqual([true, false]);
  });

  it("defaults filter to All, internalTransfers to exclude, orderDirection to desc, first to 1000, full time range", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { balanceChanges: [] } } });
    await getBalanceHistory(config, { accounts: [SUB] });

    const { variables } = post.mock.calls[0]![1] as {
      variables: {
        typeIn: string[];
        isMarginTransferSideEffectIn: boolean[];
        orderDirection: string;
        first: number;
        startDate: string;
        endDate: string;
      };
    };
    expect(variables.typeIn).toEqual(["DEPOSIT", "WITHDRAW", "BRIDGE"]);
    expect(variables.isMarginTransferSideEffectIn).toEqual([false]);
    expect(variables.orderDirection).toBe("desc");
    expect(variables.first).toBe(1000);
    expect(variables.startDate).toBe("0");
    expect(variables.endDate).toBe("2000000000");
  });
});
