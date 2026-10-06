import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, PoolTransactionStatus, PoolTransactionType } from "../types";

/**
 * Exhaustive coverage of every **filter** and **paging** input
 * `getPoolTransactions` accepts, asserted at the wire boundary: each SDK-shaped
 * param must reach the generated `/v2/market/transaction-history` client as the
 * exact query key the service expects. A silent mismatch here is invisible in
 * production — the service ignores unknown query params and returns every
 * pool's rows unfiltered — so it is pinned here instead.
 */

const getTransactionHistory = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return { ...actual, getTransactionHistoryV2MarketTransactionHistoryStartSizeGet: getTransactionHistory };
});

import { getPoolTransactions, type GetPoolTransactionsParameters } from "./get-pool-transactions";

const { config } = mockConfig();
const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const WALLET = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

/** Every member of a numeric enum (TypeScript also emits the reverse name entries). */
const DEPOSIT_CHAINS = Object.values(ListingDepositChainId).filter(
  (value): value is ListingDepositChainId => typeof value === "number",
);

/** Call the action and return the query params it handed the generated client. */
async function wireParams(parameters: GetPoolTransactionsParameters): Promise<Record<string, unknown>> {
  await getPoolTransactions(config, parameters);
  return getTransactionHistory.mock.calls.at(-1)![2] as Record<string, unknown>;
}

describe("getPoolTransactions — wire params", () => {
  beforeEach(() => {
    getTransactionHistory.mockReset();
    getTransactionHistory.mockResolvedValue({ data: { market_address: null, count: 0, data: [] } });
  });

  it("sends tokenAddress as token_address", async () => {
    expect(await wireParams({ tokenAddress: TOKEN_ADDRESS })).toEqual({ token_address: TOKEN_ADDRESS });
  });

  it("sends the deprecated marketAddress as token_address", async () => {
    expect(await wireParams({ marketAddress: TOKEN_ADDRESS })).toEqual({ token_address: TOKEN_ADDRESS });
  });

  it.each(DEPOSIT_CHAINS)("sends marketChainId %s as the numeric chain_id", async (marketChainId) => {
    expect(await wireParams({ marketChainId })).toEqual({ chain_id: marketChainId });
  });

  it("sends walletAddress as wallet_address", async () => {
    expect(await wireParams({ walletAddress: WALLET })).toEqual({ wallet_address: WALLET });
  });

  it.each(Object.values(PoolTransactionType))(
    "sends transactionType %s as transaction_type",
    async (transactionType) => {
      expect(await wireParams({ transactionType })).toEqual({ transaction_type: transactionType });
    },
  );

  it.each(Object.values(PoolTransactionStatus))(
    "sends transactionStatus %s as transaction_status",
    async (transactionStatus) => {
      expect(await wireParams({ transactionStatus })).toEqual({ transaction_status: transactionStatus });
    },
  );

  it("combines every filter in one request", async () => {
    expect(
      await wireParams({
        tokenAddress: TOKEN_ADDRESS,
        marketChainId: ListingDepositChainId.BASE,
        walletAddress: WALLET,
        transactionType: PoolTransactionType.WITHDRAW,
        transactionStatus: PoolTransactionStatus.PENDING,
      }),
    ).toEqual({
      token_address: TOKEN_ADDRESS,
      chain_id: ListingDepositChainId.BASE,
      wallet_address: WALLET,
      transaction_type: PoolTransactionType.WITHDRAW,
      transaction_status: PoolTransactionStatus.PENDING,
    });
  });

  it("never sends a sort param — the service fixes the order newest first", async () => {
    const params = await wireParams({ tokenAddress: TOKEN_ADDRESS });

    expect(Object.keys(params).some((key) => /sort|order/.test(key))).toBe(false);
  });

  it("puts paging in the path, defaulting to the first page of 50 — the backend's cap", async () => {
    await getPoolTransactions(config);
    expect(getTransactionHistory.mock.calls.at(-1)!.slice(0, 2)).toEqual([0, 50]);

    await getPoolTransactions(config, { start: 150, size: 25 });
    expect(getTransactionHistory.mock.calls.at(-1)!.slice(0, 2)).toEqual([150, 25]);
  });
});
