import { sharePercent } from "../shared/utils/percent";

/**
 * Inputs for {@link calculateMarginRisk}. Every field is 18-decimal wei `bigint`.
 *
 * The four balance fields come straight off `balanceInfoOfPartyA(account)` — an
 * `AccountBalanceInfo` spreads in as-is.
 */
export interface CalculateMarginRiskInputs {
  /** Account's allocated collateral, from `balanceInfoOfPartyA`. */
  allocatedBalance: bigint;
  /** Account's locked CVA, from `balanceInfoOfPartyA`. */
  lockedCVA: bigint;
  /** Account's locked LF, from `balanceInfoOfPartyA`. */
  lockedLF: bigint;
  /** Account's locked PartyA maintenance margin, from `balanceInfoOfPartyA`. */
  lockedPartyAMM: bigint;
  /**
   * **Signed** unrealized PnL of this **whole account** at the current mark
   * price (positive = in profit). Pass the uPnL of the same liquidation domain
   * the balance fields describe — a subset (say one group of a multi-group
   * account) understates `equity` and every figure derived from it. Pass `0n`
   * for a flat book.
   */
  upnl: bigint;
}

/**
 * Margin and liquidation-risk state of one account, as {@link calculateMarginRisk}
 * computes it. All amounts are 18-decimal wei `bigint` and may be negative where
 * the arithmetic allows it.
 */
export interface MarginRiskMetrics {
  /** Collateral allocated to the account — `allocatedBalance`. */
  totalMargin: bigint;
  /** `lockedCVA + lockedLF` — the level `equity` liquidates at. */
  maintenanceMargin: bigint;
  /**
   * `lockedPartyAMM + maintenanceMargin` — every leg partyA has locked. Matches
   * the contract's `LockedValuesOps.totalForPartyA()` (`cva + lf + partyAmm`).
   * These are live locked values, so the figure shrinks on a partial close.
   */
  initialMargin: bigint;
  /** `totalMargin + upnl` — the account's mark-to-market value. */
  equity: bigint;
  /**
   * `equity − maintenanceMargin` — the cushion left before liquidation.
   * **Negative means already liquidatable** (see {@link isLiquidatable}).
   */
  remainingToLiquidation: bigint;
  /**
   * `remainingToLiquidation / (totalMargin − maintenanceMargin) × 100` as an
   * 18-decimal fixed-point percent: how much of the account's zero-uPnL cushion
   * is still intact.
   *
   * Exceeds `100%` on a profitable book and goes negative once liquidatable —
   * **not clamped**; clamp at the render layer if you draw a bar. `undefined`
   * when the zero-uPnL cushion is not positive, because the ratio is genuinely
   * undefined there — read {@link remainingToLiquidation} and
   * {@link isLiquidatable} instead of treating it as `0`.
   */
  liquidationBufferPercent?: bigint;
  /**
   * `remainingToLiquidation < 0n` — bit-for-bit the on-chain predicate
   * `allocatedBalance − (cva + lf) + upnl < 0` from
   * `LibAccount.partyAAvailableBalanceForLiquidation` (perps-core v0.8.5).
   *
   * Prefer this over a threshold on {@link liquidationBufferPercent}: that
   * percent is a styling signal and can be `undefined`, while this is the
   * protocol's own test.
   */
  isLiquidatable: boolean;
}

/**
 * Margin and liquidation-risk state for one account (sub-account or Virtual
 * Account), from its `balanceInfoOfPartyA` fields and its unrealized PnL:
 *
 * ```
 * totalMargin              = allocatedBalance
 * maintenanceMargin        = lockedCVA + lockedLF
 * initialMargin            = lockedPartyAMM + maintenanceMargin
 * equity                   = totalMargin + upnl
 * remainingToLiquidation   = equity − maintenanceMargin
 * zeroUpnlBuffer           = totalMargin − maintenanceMargin
 * liquidationBufferPercent = remainingToLiquidation / zeroUpnlBuffer × 100
 * isLiquidatable           = remainingToLiquidation < 0
 * ```
 *
 * The liquidation condition is `equity < maintenanceMargin`, which expands to
 * the contract's own `allocatedBalance − (cva + lf) + upnl < 0`. The **price**
 * at which that happens is `calculateLiquidationPrice`.
 *
 * **Single account only.** Every figure describes one liquidation domain: each
 * Virtual Account is liquidated independently. Do not pass sums across accounts —
 * the totals would be additive but the buffer would not, and a blend hides an
 * account that is about to be liquidated behind a comfortable-looking average.
 *
 * Pure `bigint`, no IO, no rounding drift.
 *
 * @param inputs - One account's balance fields plus its signed uPnL.
 * @returns The account's margin & risk figures.
 *
 * @example
 * ```ts
 * const balance = await getAccountBalanceInfo(config, { account: virtualAccount });
 * const metrics = calculateMarginRisk({ ...balance, upnl: groupUpnl });
 * if (metrics.isLiquidatable) warn();
 * ```
 */
export function calculateMarginRisk(inputs: CalculateMarginRiskInputs): MarginRiskMetrics {
  const totalMargin = inputs.allocatedBalance;
  const maintenanceMargin = inputs.lockedCVA + inputs.lockedLF;
  const initialMargin = inputs.lockedPartyAMM + maintenanceMargin;
  const equity = totalMargin + inputs.upnl;
  const remainingToLiquidation = equity - maintenanceMargin;

  /** The same cushion measured at zero uPnL — the denominator the buffer is a share of. */
  const zeroUpnlBuffer = totalMargin - maintenanceMargin;

  return {
    totalMargin,
    maintenanceMargin,
    initialMargin,
    equity,
    remainingToLiquidation,
    /** `sharePercent` already yields `undefined` for a non-positive denominator. */
    liquidationBufferPercent: sharePercent(remainingToLiquidation, zeroUpnlBuffer),
    isLiquidatable: remainingToLiquidation < 0n,
  };
}
