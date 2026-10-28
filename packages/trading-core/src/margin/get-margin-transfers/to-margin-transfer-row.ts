import { toAddress, toBigIntOrZero, toHex } from "../../symmio-subgraph/subgraph-decode";
import type { MarginTransfersQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { MarginTransferRow } from "./types";

/** A single `marginTransfers` entity as returned by the subgraph. */
export type RawMarginTransferRow = MarginTransfersQuery["marginTransfers"][number];

/**
 * Decode one raw `marginTransfers` entity into a {@link MarginTransferRow}.
 *
 * @param row - The raw entity.
 * @returns The decoded row.
 */
export function toMarginTransferRow(row: RawMarginTransferRow): MarginTransferRow {
  return {
    id: row.id,
    type: row.type,
    virtualAccount: toAddress(row.virtualAccount.id),
    subAccount: toAddress(row.subAccount.id),
    amount: toBigIntOrZero(row.amount),
    source: toAddress(row.source),
    timestamp: Number(row.timestamp),
    blockNumber: toBigIntOrZero(row.blockNumber),
    transaction: toHex(row.transaction),
  };
}
