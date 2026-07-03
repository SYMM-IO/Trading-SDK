import { getAddress, type Hex } from "viem";
import type { TransferHistoryQuery } from "../../symmio-subgraph/types/generated/events/graphql";
import type { TransferRow } from "./types";

/** A single `internalTransfers` row as returned by the transfer-history query. */
export type RawInternalTransferRow = TransferHistoryQuery["internalTransfers"][number];

/**
 * Build a {@link TransferRow} from one `internalTransfers` row: parse the wei
 * `amount` / `blockTimestamp` strings, checksum the endpoints, and tag the
 * direction. A row is `"outgoing"` when its `sender` is one of the queried
 * accounts, otherwise `"incoming"` (the account matched on the `user` side).
 *
 * @param row - One `internalTransfers` row from {@link "InternalTransfersDocument"}.
 * @param accountSet - The queried account addresses, lowercased, for direction tagging.
 * @returns The decoded transfer row.
 */
export function toTransferRow(row: RawInternalTransferRow, accountSet: ReadonlySet<string>): TransferRow {
  return {
    id: row.id,
    from: getAddress(row.sender),
    to: getAddress(row.user),
    amount: BigInt(row.amount),
    timestamp: Number(row.blockTimestamp),
    transaction: row.transactionHash as Hex,
    direction: accountSet.has(row.sender.toLowerCase()) ? "outgoing" : "incoming",
  };
}
