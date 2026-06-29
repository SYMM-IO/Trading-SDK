import { getAddress, type Hex } from "viem";
import type { BalanceChangesQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { BalanceChangeType, MarginTransferType, type BalanceHistoryRow } from "./types";

/** A single `balanceChanges` row as returned by the history query. */
export type RawBalanceChangeRow = BalanceChangesQuery["balanceChanges"][number];

/**
 * Build a {@link BalanceHistoryRow} from one immutable `balanceChanges` row:
 * parse the wei `amount` / `timestamp` strings to numbers, checksum the account
 * address, and decode the internal-transfer tags. The `type` is one of the
 * deposit / withdraw / bridge values the query filtered on, so the narrowing cast
 * is safe; `marginTransferType` is `null` on genuine user movements.
 *
 * @param row - One `balanceChanges` row from {@link "BalanceChangesDocument"}.
 * @returns The decoded history row.
 */
export function toBalanceHistoryRow(row: RawBalanceChangeRow): BalanceHistoryRow {
  return {
    id: row.id,
    type: row.type as BalanceChangeType,
    amount: BigInt(row.amount),
    account: getAddress(row.account),
    timestamp: Number(row.timestamp),
    transaction: row.transaction as Hex,
    isInternalTransfer: row.isMarginTransferSideEffect,
    marginTransferType: row.marginTransferType ? (row.marginTransferType as MarginTransferType) : null,
  };
}
