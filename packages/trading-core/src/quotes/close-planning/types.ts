/**
 * One closable child position offered to {@link planGroupClose}. All amounts
 * are 18-decimal wei `bigint`.
 */
export interface GroupCloseCandidate {
  /** Stable child identity (`UnifiedQuote.key`). */
  key: string;
  /** Remaining open size (`quantity − closedAmount`), wei. */
  openQuantity: bigint;
  /**
   * Smallest remainder this child may keep after a partial close, wei — derived
   * from the symbol's `minAcceptableQuoteValue` (see `minRemainingQuantityOf`).
   * `0` means any remainder is acceptable; a value ≥ `openQuantity` means the
   * child can only be closed in full.
   */
  minRemainingQuantity: bigint;
}

/** Close amount {@link planGroupClose} assigned to one child. */
export interface GroupCloseAllocation {
  /** Stable child identity (`UnifiedQuote.key`). */
  key: string;
  /** Amount to close, wei. */
  closeQuantity: bigint;
  /** `full` when `closeQuantity` equals the child's `openQuantity`. */
  kind: "full" | "partial";
}

/** Why {@link planGroupClose} could not produce an exact plan. */
export type PlanGroupCloseFailureReason =
  /** The target exceeds the group's total open quantity. */
  | "exceeds-open"
  /** No candidate has open size (or the target is not positive). */
  | "nothing-to-close"
  /** Every remaining child sits at its dust cap — the exact target is unreachable. */
  | "dust-locked";

/** Failure result of {@link planGroupClose}. Nothing should be closed. */
export interface PlanGroupCloseFailure {
  feasible: false;
  reason: PlanGroupCloseFailureReason;
  /** Σ open quantity across candidates, wei. */
  totalOpen: bigint;
  /** Largest amount ≤ target the group could actually close, wei — for error messages / UI caps. */
  closeableQuantity: bigint;
}

/** Success result of {@link planGroupClose}: Σ `closeQuantity` equals the target exactly. */
export interface PlanGroupCloseSuccess {
  feasible: true;
  /** Per-child close amounts, in execution order (largest first). */
  allocations: GroupCloseAllocation[];
}

/** Result of {@link planGroupClose}. */
export type PlanGroupCloseResult = PlanGroupCloseSuccess | PlanGroupCloseFailure;
