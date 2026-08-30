import { describe, expect, it } from "vitest";
import { ListingDepositChainId, PoolTransactionStatus, PoolTransactionType } from "../types";
import {
  SupportedDepositChains,
  TransactionType,
  UserReadableTransactionStatus,
  type SearchUserTransactionsResult,
  type UserTransactionItem,
} from "../types/generated/listing-backend";
import { toUserTransaction, toUserTransactionPage } from "./to-user-transaction";

const ITEM: UserTransactionItem = {
  transaction_id: "tx-1",
  amount: "5300000000000000000",
  transaction_type: TransactionType.withdraw,
  transaction_status: UserReadableTransactionStatus.pending,
  create_time: 1_700_000_000,
  token_address: "0xToken",
  chain_id: SupportedDepositChains.NUMBER_999,
  token_name: "Demo",
  token_ticker: "DEMO",
  wallet: "0xWallet",
  token_decimal: 18,
  transaction_hash: "0xabc",
};

describe("toUserTransaction", () => {
  it("maps a row, treating amount as a 1e18 integer and preserving enum values", () => {
    expect(toUserTransaction({ ...ITEM })).toEqual({
      transactionId: "tx-1",
      type: PoolTransactionType.WITHDRAW,
      status: PoolTransactionStatus.PENDING,
      amount: 5_300_000_000_000_000_000n,
      tokenDecimals: 18,
      tokenAddress: "0xToken",
      tokenName: "Demo",
      tokenTicker: "DEMO",
      chainId: ListingDepositChainId.HYPER_EVM,
      wallet: "0xWallet",
      refundAddress: null,
      transactionHash: "0xabc",
      time: 1_700_000_000,
    });
  });

  it("defaults absent optional fields to 0n / null", () => {
    const result = toUserTransaction({ ...ITEM, amount: "", create_time: null, wallet: null, transaction_hash: null });
    expect(result.amount).toBe(0n);
    expect(result.time).toBeNull();
    expect(result.wallet).toBeNull();
    expect(result.transactionHash).toBeNull();
  });
});

describe("toUserTransactionPage", () => {
  it("maps the envelope to count + items", () => {
    const raw: SearchUserTransactionsResult = { count: 9, items: [ITEM] };
    const page = toUserTransactionPage(raw);
    expect(page.count).toBe(9);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.transactionId).toBe("tx-1");
  });

  it("tolerates an absent items array", () => {
    expect(toUserTransactionPage({ count: 0 } as SearchUserTransactionsResult)).toEqual({ count: 0, items: [] });
  });
});
