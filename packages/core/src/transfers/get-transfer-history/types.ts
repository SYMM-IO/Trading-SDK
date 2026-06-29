import type { Address, Hex } from "viem";

/**
 * Which transfers a {@link "getTransferHistory"} read returns, relative to the
 * queried accounts. Maps to the `sender_in` / `user_in` halves of the subgraph
 * `or` filter.
 */
export type TransferDirection =
  /** Both directions — the queried account is the sender or the recipient. */
  | "all"
  /** Only transfers sent FROM a queried account. */
  | "outgoing"
  /** Only transfers received BY a queried account. */
  | "incoming";

/** Direction of a single {@link TransferRow} relative to the queried accounts. */
export type TransferRowDirection = "outgoing" | "incoming";

/**
 * One internal transfer — a margin move between SYMMIO accounts, from the
 * **events** subgraph's `internalTransfers` collection (the source behind a
 * "Transfer" tab).
 *
 * @remarks
 * `from` / `to` are the raw on-chain endpoints (SubAccount / Virtual Account
 * addresses), not necessarily the controlling wallet. `amount` is a raw `bigint`
 * in **18 decimals** (account-balance units) — NOT the 6-decimal collateral units
 * used by `BalanceHistoryRow`; divide by `10^18` for display.
 */
export interface TransferRow {
  /** Subgraph entity id (use as a stable row key). */
  id: string;
  /** Sender (the `from` endpoint), checksummed. */
  from: Address;
  /** Recipient (the `to` endpoint), checksummed. */
  to: Address;
  /** Amount, raw `bigint` in 18 decimals. */
  amount: bigint;
  /** Block timestamp, unix seconds. */
  timestamp: number;
  /** Transaction hash of the transfer. */
  transaction: Hex;
  /** Whether this transfer is outgoing or incoming relative to the queried accounts. */
  direction: TransferRowDirection;
}
