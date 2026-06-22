import { formatUnits } from "viem";
import { PositionType } from "../../symmio-contracts/symmio/types";

const WEI_DECIMALS = 18;

/**
 * Inputs for {@link calculateQuotePnl}. Bigint fields are 18-decimal wei.
 */
export interface CalculateQuotePnlInputs {
  positionType: PositionType;
  /** Already-closed quantity, wei. */
  closedAmount: bigint;
  /** Average close price for the realized closes, wei. */
  closedPrice: bigint;
  /** Original opened price, wei. */
  openedPrice: bigint;
  /** Decimal-string leverage. */
  leverage: string;
}

/**
 * Return value of {@link calculateQuotePnl}.
 */
export interface CalculateQuotePnlReturnType {
  /** Realized PNL in collateral units, decimal string. `"0"` when nothing has closed. */
  pnl: string;
  /** Decimal percent (e.g. `"12.34"`). `"0"` when indeterminate. */
  pnlPercent: string;
}

/**
 * Realized PNL for a single quote — i.e. the closed-out portion only.
 *
 * - `sideSign = positionType === SHORT ? -1 : 1`
 * - `pnl = closedAmount × (closedPrice − openedPrice) × sideSign`
 * - `pnlPercent = pnl / closedAmount / openedPrice × leverage × 100`
 *   (only when `closedAmount > 0` and `openedPrice > 0`; else `"0"`).
 *
 * @example
 * ```ts
 * const { pnl, pnlPercent } = calculateQuotePnl({
 *   positionType: PositionType.LONG,
 *   closedAmount: 50n * 10n ** 18n,
 *   closedPrice: 90_000_000_000_000_000n,        // 0.09
 *   openedPrice: 80_000_000_000_000_000n,        // 0.08
 *   leverage: "10",
 * });
 * ```
 */
export function calculateQuotePnl(inputs: CalculateQuotePnlInputs): CalculateQuotePnlReturnType {
  const closedAmount = Number(formatUnits(inputs.closedAmount, WEI_DECIMALS));
  const closedPrice = Number(formatUnits(inputs.closedPrice, WEI_DECIMALS));
  const openedPrice = Number(formatUnits(inputs.openedPrice, WEI_DECIMALS));
  const leverage = Number(inputs.leverage);
  const sideSign = inputs.positionType === PositionType.SHORT ? -1 : 1;

  if (!Number.isFinite(closedAmount) || !Number.isFinite(closedPrice) || !Number.isFinite(openedPrice) || closedAmount <= 0) {
    return { pnl: "0", pnlPercent: "0" };
  }

  const pnl = closedAmount * (closedPrice - openedPrice) * sideSign;
  if (!Number.isFinite(pnl)) return { pnl: "0", pnlPercent: "0" };

  if (openedPrice <= 0 || !Number.isFinite(leverage)) {
    return { pnl: String(pnl), pnlPercent: "0" };
  }
  const pnlPercent = (pnl / closedAmount / openedPrice) * leverage * 100;
  if (!Number.isFinite(pnlPercent)) return { pnl: String(pnl), pnlPercent: "0" };

  return { pnl: String(pnl), pnlPercent: pnlPercent.toFixed(2) };
}
