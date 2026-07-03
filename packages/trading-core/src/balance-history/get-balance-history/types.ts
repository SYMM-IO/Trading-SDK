import type { Address, Hex } from "viem";

/**
 * Subgraph `BalanceChange.type` values for the collateral movements that make up
 * deposit / withdraw history.
 *
 * @remarks
 * Mirrors the `type` strings emitted by the SYMMIO analytics subgraph. The
 * subgraph also emits margin moves (`ALLOCATE` / `DEALLOCATE`); those are out of
 * scope for this slice and are never returned by {@link "getBalanceHistory"}.
 */
export enum BalanceChangeType {
  /** Collateral deposited into a sub-account. */
  Deposit = "DEPOSIT",
  /** Collateral withdrawn from a sub-account. */
  Withdraw = "WITHDRAW",
  /** A withdraw routed through a bridge (instant / CCTP). Treated as a withdraw. */
  Bridge = "BRIDGE",
}

/**
 * Filter selecting which movements a {@link "getBalanceHistory"} read returns.
 * Maps to the subgraph `type_in` clause via {@link "balanceHistoryFilterToTypes"}.
 */
export enum BalanceHistoryFilter {
  /** Deposits and withdraws (including bridge withdraws). */
  All = "All",
  /** Deposits only. */
  Deposit = "Deposit",
  /** Withdraws, including bridge withdraws. */
  Withdraw = "Withdraw",
}

/**
 * The kind of margin transfer an internal-transfer leg belongs to (subgraph
 * `BalanceChange.marginTransferType`). Present only on rows where
 * {@link BalanceHistoryRow.isInternalTransfer} is `true`.
 *
 * @remarks
 * A margin transfer moves collateral between a user's own SubAccount and one of
 * its Virtual Accounts; it expands into a cluster of primitive balance legs that
 * carry this tag (verified against the live analytics subgraph).
 */
export enum MarginTransferType {
  /** Funding a Virtual Account's margin from the SubAccount. */
  Add = "ADD",
  /** Pulling margin out of a Virtual Account back to the SubAccount. */
  Remove = "REMOVE",
  /** Margin automatically returned to the SubAccount (e.g. on close / deallocate). */
  AutoReturn = "AUTO_RETURN",
}

/**
 * How a {@link "getBalanceHistory"} read treats **internal margin-transfer legs**
 * — the `WITHDRAW` / `DEPOSIT` rows that are bookkeeping side effects of moving
 * margin between a user's own accounts, not real collateral movements in or out
 * of the protocol. Maps to the subgraph `isMarginTransferSideEffect` filter.
 *
 * @remarks
 * Orthogonal to {@link BalanceHistoryFilter} (which chooses deposit vs withdraw):
 * `filter` picks the direction, `internalTransfers` picks real-vs-transfer.
 */
export type InternalTransfersMode =
  /** Only genuine user deposits / withdrawals (`isMarginTransferSideEffect: false`). The default. */
  | "exclude"
  /** Only internal-transfer legs (`isMarginTransferSideEffect: true`). */
  | "only"
  /** Both — no constraint on `isMarginTransferSideEffect`. */
  | "include";

/**
 * One settled collateral movement (deposit or withdraw) on a sub-account.
 *
 * @remarks
 * `amount` is a raw `bigint` in the **collateral token's decimals** (not 18) —
 * scale it with `config.getChainConfig(chainId).addresses.collateralDecimals`
 * (6 on HyperEVM) for display.
 */
export interface BalanceHistoryRow {
  /** Subgraph entity id (use as a stable row key). */
  id: string;
  /** Movement kind, decoded from the subgraph `type`. */
  type: BalanceChangeType;
  /** Amount, raw `bigint` in collateral decimals. */
  amount: bigint;
  /** The sub-account the movement belongs to. */
  account: Address;
  /** Block timestamp, unix seconds. */
  timestamp: number;
  /** Transaction hash of the movement. */
  transaction: Hex;
  /**
   * `true` when this row is an internal margin-transfer leg (a side effect of
   * moving margin between the user's own SubAccount and a Virtual Account) rather
   * than a real user deposit / withdrawal. Always `false` under the default
   * `internalTransfers: "exclude"`; only meaningful when transfers are included.
   */
  isInternalTransfer: boolean;
  /** The margin-transfer kind when {@link isInternalTransfer} is `true`; otherwise `null`. */
  marginTransferType: MarginTransferType | null;
}
