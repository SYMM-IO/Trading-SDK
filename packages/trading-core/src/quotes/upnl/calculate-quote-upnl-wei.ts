import { WEI } from "../../shared/utils/wei";
import { PositionType } from "../../symmio-contracts/symmio/types";

/**
 * Inputs for {@link calculateQuoteUpnlWei}. All amounts are 18-decimal wei.
 */
export interface CalculateQuoteUpnlWeiParameters {
  /** Trade side — flips the sign of the mark-vs-open difference. */
  positionType: PositionType;
  /** Remaining open size (`quantity − closedAmount`), wei. */
  openQuantity: bigint;
  /** Settled open price, wei. */
  openedPrice: bigint;
  /** Current mark price, wei. */
  markPrice: bigint;
}

/**
 * A single position's unrealized PnL as a signed 18-decimal wei `bigint`:
 *
 * `upnl = openQuantity × (markPrice − openedPrice)` for LONG, negated for
 * SHORT, rescaled to wei.
 *
 * The exact-`bigint` sibling of `calculateQuoteUpnl` (which formats decimal
 * strings for display): use this wherever the uPnL feeds further wei math —
 * e.g. summing an account's positions for `calculateAvailableForOrder`.
 *
 * @param parameters - Side, open size, open price, and mark price.
 * @returns The signed unrealized PnL, wei.
 *
 * @example
 * ```ts
 * const upnl = calculateQuoteUpnlWei({
 *   positionType: PositionType.LONG,
 *   openQuantity: 2n * 10n ** 18n,
 *   openedPrice: 100n * 10n ** 18n,
 *   markPrice: 110n * 10n ** 18n,
 * }); // → 20e18
 * ```
 */
export function calculateQuoteUpnlWei(parameters: CalculateQuoteUpnlWeiParameters): bigint {
  const difference = parameters.markPrice - parameters.openedPrice;
  const signed = parameters.positionType === PositionType.LONG ? difference : -difference;
  return (parameters.openQuantity * signed) / WEI;
}
