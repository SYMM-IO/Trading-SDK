import { describe, expect, it } from "vitest";
import { ListingDepositChainId, PoolTransactionStatus, PoolTransactionType } from "../types";
import {
  TransactionType,
  UserReadableTransactionStatus,
  type MarketTransaction,
} from "../types/generated/listing-backend";
import { toPoolTransaction, toPoolTransactionPage } from "./to-pool-transaction";

/** A live deposit row, trimmed to the fields under test. */
function makeRow(overrides: Partial<MarketTransaction> = {}): MarketTransaction {
  return {
    transaction_id: "3f0c7c1e-0f7a-4c02-9d5d-9d3d2a6f1a11",
    token_address: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
    chain_id: ListingDepositChainId.BASE,
    wallet_address: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
    amount: "14340638353162345849846",
    usdc_amount: "14340638353162345849846",
    token_amount: "38635451216126673641847703",
    transaction_hash: "0xdead",
    refund_address: null,
    refund_transaction_hash: null,
    refund_time: null,
    type: TransactionType.deposit,
    status: UserReadableTransactionStatus.success,
    time: 1772715579,
    ...overrides,
  };
}

describe("toPoolTransaction", () => {
  it("maps identity, amounts and lifecycle in one pass", () => {
    expect(toPoolTransaction(makeRow())).toEqual({
      transactionId: "3f0c7c1e-0f7a-4c02-9d5d-9d3d2a6f1a11",
      tokenAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
      chainId: ListingDepositChainId.BASE,
      walletAddress: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
      amount: 14340638353162345849846n,
      usdcAmount: 14340638353162345849846n,
      tokenAmount: 38635451216126673641847703n,
      transactionHash: "0xdead",
      refundAddress: null,
      refundTransactionHash: null,
      refundTime: null,
      type: PoolTransactionType.DEPOSIT,
      status: PoolTransactionStatus.SUCCESS,
      time: 1772715579,
    });
  });

  it("names the row's own pool, so a row from an all-pools page stays attributable", () => {
    const row = toPoolTransaction(
      makeRow({
        token_address: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
        chain_id: ListingDepositChainId.SOLANA,
      }),
    );

    expect(row.tokenAddress).toBe("pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn");
    expect(row.chainId).toBe(ListingDepositChainId.SOLANA);
  });

  it("reads every deposit chain the service reports as its ListingDepositChainId member", () => {
    expect(toPoolTransaction(makeRow({ chain_id: ListingDepositChainId.ROBINHOOD })).chainId).toBe(
      ListingDepositChainId.ROBINHOOD,
    );
    expect(toPoolTransaction(makeRow({ chain_id: ListingDepositChainId.ARC })).chainId).toBe(ListingDepositChainId.ARC);
  });

  it("collapses an absent amount to zero — a missing value and no money moved read the same", () => {
    const row = toPoolTransaction(makeRow({ amount: "", usdc_amount: "not-a-number", token_amount: "" }));

    expect(row.amount).toBe(0n);
    expect(row.usdcAmount).toBe(0n);
    expect(row.tokenAmount).toBe(0n);
  });

  it("truncates a fractional wire amount rather than rejecting the row", () => {
    expect(toPoolTransaction(makeRow({ amount: "1500000000000000000.75" })).amount).toBe(1500000000000000000n);
  });

  it("nulls the optional hash and refund fields the backend may omit entirely", () => {
    const row = toPoolTransaction(
      makeRow({
        transaction_hash: undefined,
        refund_address: undefined,
        refund_transaction_hash: undefined,
        refund_time: undefined,
      }),
    );

    expect(row).toMatchObject({
      transactionHash: null,
      refundAddress: null,
      refundTransactionHash: null,
      refundTime: null,
    });
  });

  it("carries a refunded deposit's refund fields through", () => {
    const row = toPoolTransaction(
      makeRow({
        status: UserReadableTransactionStatus.refund,
        refund_address: "0xrefund",
        refund_transaction_hash: "0xbeef",
        refund_time: 1772800000,
      }),
    );

    expect(row).toMatchObject({
      status: PoolTransactionStatus.REFUND,
      refundAddress: "0xrefund",
      refundTransactionHash: "0xbeef",
      refundTime: 1772800000,
    });
  });

  it("preserves the wire enum values, so the cast is value-preserving in both directions", () => {
    expect(toPoolTransaction(makeRow({ type: TransactionType.withdraw })).type).toBe(PoolTransactionType.WITHDRAW);
    expect(toPoolTransaction(makeRow({ status: UserReadableTransactionStatus.pending })).status).toBe(
      PoolTransactionStatus.PENDING,
    );
    expect(toPoolTransaction(makeRow({ status: UserReadableTransactionStatus.canceled })).status).toBe(
      PoolTransactionStatus.CANCELED,
    );
    expect(toPoolTransaction(makeRow({ status: UserReadableTransactionStatus.rejected })).status).toBe(
      PoolTransactionStatus.REJECTED,
    );
  });
});

describe("toPoolTransactionPage", () => {
  it("keeps the backend's total count rather than the page length, so a pager can divide it", () => {
    const page = toPoolTransactionPage({
      market_address: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
      count: 412,
      data: [makeRow(), makeRow({ transaction_id: "second" })],
    });

    expect(page.marketAddress).toBe("0x800822d361335b4d5F352Dac293cA4128b5B605f");
    expect(page.count).toBe(412);
    expect(page.items).toHaveLength(2);
    expect(page.count).not.toBe(page.items.length);
  });

  it("reads a page that spans every pool as marketAddress null, with each row naming its pool", () => {
    const page = toPoolTransactionPage({
      market_address: null,
      count: 1658,
      data: [
        makeRow(),
        makeRow({
          token_address: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
          chain_id: ListingDepositChainId.SOLANA,
        }),
      ],
    });

    expect(page.marketAddress).toBeNull();
    expect(page.items.map((row) => row.tokenAddress)).toEqual([
      "0x800822d361335b4d5F352Dac293cA4128b5B605f",
      "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    ]);
  });

  it("tolerates an envelope that omits market_address entirely", () => {
    const page = toPoolTransactionPage({
      count: 0,
      data: [],
    } as unknown as Parameters<typeof toPoolTransactionPage>[0]);

    expect(page.marketAddress).toBeNull();
  });

  it("returns an empty page when the envelope carries no rows", () => {
    expect(
      toPoolTransactionPage({
        market_address: "0xdead",
        count: 0,
        data: undefined as unknown as [],
      }).items,
    ).toEqual([]);
  });
});
