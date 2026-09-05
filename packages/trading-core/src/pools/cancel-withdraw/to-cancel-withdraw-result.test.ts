import { describe, expect, it } from "vitest";
import { TransactionStatus } from "../types/generated/listing-backend";
import { toCancelWithdrawResult } from "./to-cancel-withdraw-result";

describe("toCancelWithdrawResult", () => {
  it("maps the transaction id and status through", () => {
    expect(toCancelWithdrawResult({ transaction_id: "tx-1", transaction_status: TransactionStatus.canceled })).toEqual({
      transactionId: "tx-1",
      status: "canceled",
    });
  });
});
