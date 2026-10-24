import type { Address, Hex } from "viem";
import type { MarginTransferType } from "../../balance-history/get-balance-history/types";

/**
 * One `MarginTransfer` entity: margin moved between a SubAccount and one of its
 * Virtual Accounts. Amounts are 18-decimal wei `bigint`.
 */
export interface MarginTransferRow {
  /** Subgraph entity id (stable; use as a row key or `idGt` cursor). */
  id: string;
  /** Transfer direction — see {@link MarginTransferType}. */
  type: MarginTransferType | (string & {});
  /** The Virtual Account the margin moved into or out of. */
  virtualAccount: Address;
  /** The SubAccount that owns the Virtual Account. */
  subAccount: Address;
  /** Amount moved (wei). */
  amount: bigint;
  /** Diamond address the transfer was indexed from (the subgraph's `source`). */
  source: Address;
  /** Block timestamp (unix seconds). */
  timestamp: number;
  /** Block number. */
  blockNumber: bigint;
  /** Transaction hash. */
  transaction: Hex;
}
