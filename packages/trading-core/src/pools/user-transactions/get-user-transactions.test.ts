import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { PoolTransactionType } from "../types";

const searchUserTransactionsV2MarketUserTransactionsStartSizeGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    searchUserTransactionsV2MarketUserTransactionsStartSizeGet,
  };
});

import { getUserTransactions } from "./get-user-transactions";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getUserTransactions", () => {
  beforeEach(() => {
    searchUserTransactionsV2MarketUserTransactionsStartSizeGet.mockReset();
  });

  it("requests the page with the bearer token and normalizes the response", async () => {
    const { config } = mockConfig();
    searchUserTransactionsV2MarketUserTransactionsStartSizeGet.mockResolvedValue({
      data: {
        count: 1,
        items: [
          {
            transaction_id: "tx-1",
            amount: "5300000000000000000",
            transaction_type: "withdraw",
            transaction_status: "pending",
            create_time: 1_700_000_000,
            token_address: "0xToken",
            chain_id: 999,
            token_name: "Demo",
            token_ticker: "DEMO",
            token_decimal: 18,
          },
        ],
      },
    });

    const page = await getUserTransactions(config, { accessToken: "TOKEN123", size: 25 });
    expect(page.count).toBe(1);
    expect(page.items[0]?.amount).toBe(5_300_000_000_000_000_000n);

    expect(searchUserTransactionsV2MarketUserTransactionsStartSizeGet).toHaveBeenCalledWith(
      0,
      25,
      {},
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
  });

  it("forwards the type filter only when set", async () => {
    const { config } = mockConfig();
    searchUserTransactionsV2MarketUserTransactionsStartSizeGet.mockResolvedValue({ data: { count: 0, items: [] } });

    await getUserTransactions(config, { accessToken: "t", transactionType: PoolTransactionType.WITHDRAW });

    expect(searchUserTransactionsV2MarketUserTransactionsStartSizeGet).toHaveBeenCalledWith(
      0,
      150,
      { transaction_type: "withdraw" },
      expect.anything(),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getUserTransactions(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    await expect(
      getUserTransactions(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" }),
    ).rejects.toBeInstanceOf(SymmError);
    expect(searchUserTransactionsV2MarketUserTransactionsStartSizeGet).not.toHaveBeenCalled();
  });
});
