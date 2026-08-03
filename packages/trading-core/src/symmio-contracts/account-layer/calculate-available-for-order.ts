import type { AccountBalanceInfo } from "./types";

/**
 * Inputs for {@link calculateAvailableForOrder}. All amounts are the raw
 * 18-decimal wei `bigint`s the balance-info read returns.
 */
export interface CalculateAvailableForOrderParameters {
  /** The account's `balanceInfoOfPartyA` snapshot. */
  balanceInfo: AccountBalanceInfo;
  /** Account-level unrealized PnL, signed wei. */
  upnl: bigint;
  /**
   * Margin already committed to **off-chain** quotes the chain has not
   * anchored yet (Σ locked legs of optimistic opens) — the on-chain snapshot's
   * locked/pending fields cannot know it, so it is subtracted like the pending
   * locked legs. Once a quote anchors, drop it from this figure: the snapshot
   * covers it from then on.
   * @default 0n
   */
  offchainPendingLocked?: bigint;
}

/**
 * Collateral a cross-margin (majors) account can still commit to a **new
 * order**, mirroring the reference trade panel's formula.
 *
 * With `totalPending = Σ pending locked legs (cva + lf + partyAmm + partyBmm)`:
 *
 * - `upnl ≥ 0`:
 *   `allocatedBalance + upnl − (lockedCVA + lockedLF + lockedPartyAMM) − totalPending`
 * - `upnl < 0`:
 *   `allocatedBalance − lockedCVA − lockedLF − totalPending − max(−upnl, lockedPartyAMM)`
 *
 * The negative branch charges the **larger** of the loss and the maintenance
 * margin: the MM absorbs drawdown first, so the loss only starts reducing the
 * spendable balance beyond what the MM already reserves — never both in full.
 *
 * Can return a negative value when the account is under water; clamp at the
 * call site if a floor of zero is wanted for display.
 *
 * @param parameters - Balance snapshot and signed account uPnL.
 * @returns The spendable collateral for a new order, signed wei.
 *
 * @example
 * ```ts
 * const available = calculateAvailableForOrder({ balanceInfo, upnl: attestation.uPnl });
 * ```
 */
export function calculateAvailableForOrder(parameters: CalculateAvailableForOrderParameters): bigint {
  const { balanceInfo, upnl, offchainPendingLocked = 0n } = parameters;
  const {
    allocatedBalance,
    lockedCVA,
    lockedLF,
    lockedPartyAMM,
    pendingLockedCVA,
    pendingLockedLF,
    pendingLockedPartyAMM,
    pendingLockedPartyBMM,
  } = balanceInfo;

  const totalPendingLocked =
    pendingLockedCVA + pendingLockedLF + pendingLockedPartyAMM + pendingLockedPartyBMM + offchainPendingLocked;

  if (upnl >= 0n) {
    const totalLocked = lockedCVA + lockedLF + lockedPartyAMM;
    return allocatedBalance + upnl - totalLocked - totalPendingLocked;
  }

  const loss = -upnl;
  const consideringMM = loss > lockedPartyAMM ? loss : lockedPartyAMM;
  return allocatedBalance - lockedCVA - lockedLF - totalPendingLocked - consideringMM;
}
