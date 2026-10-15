import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, PoolTransactionStatus, PoolTransactionType } from "../types";

const getTransactionHistoryV2MarketTransactionHistoryStartSizeGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return { ...actual, getTransactionHistoryV2MarketTransactionHistoryStartSizeGet };
});

import { getPoolTransactionsQueryKey, getPoolTransactionsQueryOptions } from "./query";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).listing?.url;
const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const OTHER_TOKEN_ADDRESS = "0xFb31f85A8367210B2e4Ed2360D2dA9Dc2D2Ccc95";
const WALLET = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

describe("getPoolTransactionsQueryKey", () => {
  it("tags the key with the action name and carries the query-defining fields", () => {
    const key = getPoolTransactionsQueryKey({
      tokenAddress: TOKEN_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      transactionType: PoolTransactionType.DEPOSIT,
      transactionStatus: PoolTransactionStatus.SUCCESS,
      start: 50,
      size: 25,
      configKey: "k",
    });

    expect(key[0]).toBe("getPoolTransactions");
    expect(key[1]).toEqual({
      tokenAddress: TOKEN_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      transactionType: PoolTransactionType.DEPOSIT,
      transactionStatus: PoolTransactionStatus.SUCCESS,
      start: 50,
      size: 25,
      configKey: "k",
    });
  });

  it("keeps an unfiltered key free of filter fields, so it never matches a filtered page", () => {
    expect(getPoolTransactionsQueryKey({ configKey: "k" })[1]).toEqual({ configKey: "k" });
  });

  it.each([
    ["tokenAddress", { tokenAddress: TOKEN_ADDRESS }],
    ["marketChainId", { marketChainId: ListingDepositChainId.BASE }],
    ["walletAddress", { walletAddress: WALLET }],
    ["transactionType", { transactionType: PoolTransactionType.WITHDRAW }],
    ["transactionStatus", { transactionStatus: PoolTransactionStatus.PENDING }],
  ])("separates a page filtered by %s from the unfiltered one", (_name, filter) => {
    expect(getPoolTransactionsQueryKey({ ...filter, configKey: "k" })).not.toEqual(
      getPoolTransactionsQueryKey({ configKey: "k" }),
    );
  });

  it("separates pages, so paging does not overwrite one cache entry", () => {
    const first = getPoolTransactionsQueryKey({ tokenAddress: TOKEN_ADDRESS, start: 0, size: 25, configKey: "k" });
    const second = getPoolTransactionsQueryKey({ tokenAddress: TOKEN_ADDRESS, start: 25, size: 25, configKey: "k" });

    expect(second).not.toEqual(first);
  });

  it("folds the deprecated marketAddress into tokenAddress, so both spellings share one cache entry", () => {
    expect(getPoolTransactionsQueryKey({ marketAddress: TOKEN_ADDRESS, configKey: "k" })).toEqual(
      getPoolTransactionsQueryKey({ tokenAddress: TOKEN_ADDRESS, configKey: "k" }),
    );
  });

  it("keys on tokenAddress when both spellings are set, matching the address the request sends", () => {
    expect(
      getPoolTransactionsQueryKey({ tokenAddress: TOKEN_ADDRESS, marketAddress: OTHER_TOKEN_ADDRESS, configKey: "k" }),
    ).toEqual(getPoolTransactionsQueryKey({ tokenAddress: TOKEN_ADDRESS, configKey: "k" }));
  });
});

describe("getPoolTransactionsQueryOptions", () => {
  beforeEach(() => {
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockReset();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({
      data: { market_address: null, count: 0, data: [] },
    });
  });

  it("is enabled by default and takes no required parameters", () => {
    const { config } = mockConfig();
    const options = getPoolTransactionsQueryOptions(config);

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getPoolTransactions");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(getPoolTransactionsQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("forwards every parameter to the service — the key and the request never disagree", async () => {
    const { config } = mockConfig();

    await getPoolTransactionsQueryOptions(config, {
      tokenAddress: TOKEN_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      walletAddress: WALLET,
      transactionType: PoolTransactionType.WITHDRAW,
      transactionStatus: PoolTransactionStatus.PENDING,
      start: 25,
      size: 25,
      query: { staleTime: 1_000 },
    }).queryFn();

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      25,
      25,
      {
        token_address: TOKEN_ADDRESS,
        chain_id: ListingDepositChainId.BASE,
        wallet_address: WALLET,
        transaction_type: PoolTransactionType.WITHDRAW,
        transaction_status: PoolTransactionStatus.PENDING,
      },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
  });

  it("reads every pool's first page when given no filters", async () => {
    const { config } = mockConfig();

    await getPoolTransactionsQueryOptions(config).queryFn();

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      0,
      50,
      {},
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
  });
});
