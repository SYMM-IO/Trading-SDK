import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, PoolTransactionStatus, PoolTransactionType } from "../types";
import { TransactionType, UserReadableTransactionStatus } from "../types/generated/listing-backend";

const getTransactionHistoryV2MarketTransactionHistoryStartSizeGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet,
  };
});

import { getPoolTransactions } from "./get-pool-transactions";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).listing?.url;
const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const OTHER_TOKEN_ADDRESS = "0xFb31f85A8367210B2e4Ed2360D2dA9Dc2D2Ccc95";
const SOLANA_TOKEN_ADDRESS = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
const WALLET = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

/** One raw row, shaped like the live transaction-history response. */
function makeRow(tokenAddress: string, chainId: ListingDepositChainId, transactionId: string) {
  return {
    transaction_id: transactionId,
    token_address: tokenAddress,
    chain_id: chainId,
    wallet_address: WALLET,
    amount: "1000000000000000000",
    usdc_amount: "1000000000000000000",
    token_amount: "5000000000000000000",
    transaction_hash: "0xdead",
    refund_address: null,
    refund_transaction_hash: null,
    refund_time: null,
    type: TransactionType.deposit,
    status: UserReadableTransactionStatus.success,
    time: 1772715579,
  };
}

/** An unfiltered page: the envelope names no pool, and each row names its own. */
const ALL_POOLS_PAGE = {
  market_address: null,
  count: 1658,
  data: [
    makeRow(TOKEN_ADDRESS, ListingDepositChainId.BASE, "tx-1"),
    makeRow(SOLANA_TOKEN_ADDRESS, ListingDepositChainId.SOLANA, "tx-2"),
  ],
};

/** A page narrowed to one pool: the envelope echoes the token address. */
const ONE_POOL_PAGE = {
  market_address: TOKEN_ADDRESS,
  count: 412,
  data: [makeRow(TOKEN_ADDRESS, ListingDepositChainId.BASE, "tx-1")],
};

/** An axios rejection shaped the way the listing backend fails. */
function axiosFailure(status: number, statusText: string, data: unknown): AxiosError {
  return Object.assign(new AxiosError(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config: { url: "/v2/market/transaction-history/0/50", method: "get" },
    response: { status, statusText, data },
  }) as AxiosError;
}

describe("getPoolTransactions", () => {
  beforeEach(() => {
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockReset();
  });

  it("reads every pool when called without filters, and each row names its own pool", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: ALL_POOLS_PAGE });

    const page = await getPoolTransactions(config);

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      0,
      50,
      {},
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(page.marketAddress).toBeNull();
    expect(page.count).toBe(1658);
    expect(page.items.map((row) => [row.tokenAddress, row.chainId])).toEqual([
      [TOKEN_ADDRESS, ListingDepositChainId.BASE],
      [SOLANA_TOKEN_ADDRESS, ListingDepositChainId.SOLANA],
    ]);
  });

  it("narrows to one pool with tokenAddress, and the page echoes it", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: ONE_POOL_PAGE });

    const page = await getPoolTransactions(config, { tokenAddress: TOKEN_ADDRESS });

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      0,
      50,
      { token_address: TOKEN_ADDRESS },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(page).toMatchObject({ marketAddress: TOKEN_ADDRESS, count: 412 });
    expect(page.items[0]).toMatchObject({
      transactionId: "tx-1",
      tokenAddress: TOKEN_ADDRESS,
      amount: 1000000000000000000n,
      type: PoolTransactionType.DEPOSIT,
      status: PoolTransactionStatus.SUCCESS,
    });
  });

  it("sends the deprecated marketAddress as token_address, never as the service's retiring market_address alias", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: ONE_POOL_PAGE });

    await getPoolTransactions(config, { marketAddress: TOKEN_ADDRESS });

    const params = getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mock.calls[0]![2] as Record<
      string,
      unknown
    >;
    expect(params).toEqual({ token_address: TOKEN_ADDRESS });
    expect("market_address" in params).toBe(false);
  });

  it("lets tokenAddress win when the deprecated marketAddress is passed too", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: ONE_POOL_PAGE });

    await getPoolTransactions(config, { tokenAddress: TOKEN_ADDRESS, marketAddress: OTHER_TOKEN_ADDRESS });

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mock.calls[0]![2]).toEqual({
      token_address: TOKEN_ADDRESS,
    });
  });

  it("omits every unset filter entirely rather than sending an undefined one", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: ALL_POOLS_PAGE });

    await getPoolTransactions(config, {
      tokenAddress: undefined,
      marketAddress: undefined,
      marketChainId: undefined,
      walletAddress: undefined,
      transactionType: undefined,
      transactionStatus: undefined,
    });

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mock.calls[0]![2]).toEqual({});
  });

  it("pages through the path and narrows to one wallet when asked", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: ONE_POOL_PAGE });

    await getPoolTransactions(config, { tokenAddress: TOKEN_ADDRESS, walletAddress: WALLET, start: 50, size: 25 });

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      50,
      25,
      { token_address: TOKEN_ADDRESS, wallet_address: WALLET },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    const call = () =>
      getPoolTransactions(config, { chainId: SymmioSupportedChainId.BASE, tokenAddress: TOKEN_ADDRESS });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).not.toHaveBeenCalled();
  });

  it("wraps an axios rejection as SymmApiError tagged FETCH_POOL_TRANSACTIONS_FAILED", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockRejectedValue(
      axiosFailure(503, "Service Unavailable", { detail: "backend down" }),
    );

    const error = await getPoolTransactions(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_POOL_TRANSACTIONS_FAILED",
      status: 503,
      statusText: "Service Unavailable",
      responseData: { detail: "backend down" },
    });
  });

  it("surfaces an unlisted tokenAddress as the service's 400, not as an empty page", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockRejectedValue(
      axiosFailure(400, "Bad Request", { error_code: 21, error_message: "Market not found", error_detail: null }),
    );

    const error = await getPoolTransactions(config, { tokenAddress: TOKEN_ADDRESS }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      code: "FETCH_POOL_TRANSACTIONS_FAILED",
      status: 400,
      responseData: { error_message: "Market not found" },
    });
  });

  it("wraps a non-axios rejection as a SymmError of kind `api` carrying the cause", async () => {
    const { config } = mockConfig();
    const cause = new Error("boom");
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockRejectedValue(cause);

    const error = await getPoolTransactions(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "api", code: "FETCH_POOL_TRANSACTIONS_FAILED", cause });
    expect((error as SymmError).message).toContain("boom");
  });
});
