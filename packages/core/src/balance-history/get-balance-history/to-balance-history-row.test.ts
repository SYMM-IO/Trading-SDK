import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { toBalanceHistoryRow, type RawBalanceChangeRow } from "./to-balance-history-row";
import { BalanceChangeType, MarginTransferType } from "./types";

const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

describe("toBalanceHistoryRow", () => {
  it("parses wei strings to bigint/number and checksums the account", () => {
    const raw: RawBalanceChangeRow = {
      id: "0xabc-3",
      type: "WITHDRAW",
      amount: "999950",
      account: SUB.toLowerCase(),
      timestamp: "1780501280",
      transaction: "0xdead",
      isMarginTransferSideEffect: false,
      marginTransferType: null,
    };

    expect(toBalanceHistoryRow(raw)).toEqual({
      id: "0xabc-3",
      type: BalanceChangeType.Withdraw,
      amount: 999950n,
      account: getAddress(SUB),
      timestamp: 1780501280,
      transaction: "0xdead",
      isInternalTransfer: false,
      marginTransferType: null,
    });
  });

  it("decodes a bridge withdraw to its own type", () => {
    const raw: RawBalanceChangeRow = {
      id: "0xbeef-1",
      type: "BRIDGE",
      amount: "5000000",
      account: SUB.toLowerCase(),
      timestamp: "1780000000",
      transaction: "0xbeef",
      isMarginTransferSideEffect: false,
      marginTransferType: null,
    };

    expect(toBalanceHistoryRow(raw).type).toBe(BalanceChangeType.Bridge);
  });

  it("flags an internal margin-transfer leg and decodes its marginTransferType", () => {
    const raw: RawBalanceChangeRow = {
      id: "0xadd-1",
      type: "WITHDRAW",
      amount: "2572689",
      account: SUB.toLowerCase(),
      timestamp: "1781000000",
      transaction: "0xd9f1",
      isMarginTransferSideEffect: true,
      marginTransferType: "ADD",
    };

    const row = toBalanceHistoryRow(raw);
    expect(row.isInternalTransfer).toBe(true);
    expect(row.marginTransferType).toBe(MarginTransferType.Add);
  });
});
