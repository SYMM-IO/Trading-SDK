import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { PoolTransactionStatus, PoolTransactionType } from "../types";
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

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const MARKET_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const WALLET = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

const PAGE = {
  market_address: MARKET_ADDRESS,
  count: 412,
  data: [
    {
      transaction_id: "tx-1",
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
    },
  ],
};

/** An axios rejection shaped the way the listing backend fails. */
function axiosFailure(): AxiosError {
  return Object.assign(new AxiosError("Request failed with status code 503"), {
    isAxiosError: true,
    config: { url: "/v2/market/transaction-history/0/150", method: "get" },
    response: { status: 503, statusText: "Service Unavailable", data: { detail: "backend down" } },
  }) as AxiosError;
}

describe("getPoolTransactions", () => {
  beforeEach(() => {
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockReset();
  });

  it("pages through the path, filters by market only, and returns the mapped page", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: PAGE });

    const page = await getPoolTransactions(config, { marketAddress: MARKET_ADDRESS });

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      0,
      150,
      { market_address: MARKET_ADDRESS },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(page).toMatchObject({ marketAddress: MARKET_ADDRESS, count: 412 });
    expect(page.items[0]).toMatchObject({
      transactionId: "tx-1",
      amount: 1000000000000000000n,
      type: PoolTransactionType.DEPOSIT,
      status: PoolTransactionStatus.SUCCESS,
    });
  });

  it("omits the wallet filter entirely rather than sending an undefined one", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: PAGE });

    await getPoolTransactions(config, { marketAddress: MARKET_ADDRESS, walletAddress: undefined });

    const params = getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mock.calls[0]![2] as Record<
      string,
      unknown
    >;
    expect(params).toEqual({ market_address: MARKET_ADDRESS });
    expect("wallet_address" in params).toBe(false);
  });

  it("narrows the page to one wallet when asked", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockResolvedValue({ data: PAGE });

    await getPoolTransactions(config, { marketAddress: MARKET_ADDRESS, walletAddress: WALLET, start: 50, size: 25 });

    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).toHaveBeenCalledWith(
      50,
      25,
      { market_address: MARKET_ADDRESS, wallet_address: WALLET },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    const call = () =>
      getPoolTransactions(config, { chainId: SymmioSupportedChainId.BASE, marketAddress: MARKET_ADDRESS });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getTransactionHistoryV2MarketTransactionHistoryStartSizeGet).not.toHaveBeenCalled();
  });

  it("wraps an axios rejection as SymmApiError tagged FETCH_POOL_TRANSACTIONS_FAILED", async () => {
    const { config } = mockConfig();
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockRejectedValue(axiosFailure());

    const error = await getPoolTransactions(config, { marketAddress: MARKET_ADDRESS }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_POOL_TRANSACTIONS_FAILED",
      status: 503,
      statusText: "Service Unavailable",
      responseData: { detail: "backend down" },
    });
  });

  it("wraps a non-axios rejection as a SymmError of kind `api` carrying the cause", async () => {
    const { config } = mockConfig();
    const cause = new Error("boom");
    getTransactionHistoryV2MarketTransactionHistoryStartSizeGet.mockRejectedValue(cause);

    const error = await getPoolTransactions(config, { marketAddress: MARKET_ADDRESS }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "api", code: "FETCH_POOL_TRANSACTIONS_FAILED", cause });
    expect((error as SymmError).message).toContain("boom");
  });
});
