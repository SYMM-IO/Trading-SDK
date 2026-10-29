import { toDecimal } from "@symmio/utils";
import { formatUnits, parseUnits } from "viem";
import { PositionType } from "../../symmio-contracts/symmio/types";

const WEI_DECIMALS = 18;

/**
 * Inputs for {@link calculateQuoteUpnl}. Bigint fields are 18-decimal wei.
 */
export interface CalculateQuoteUpnlInputs {
  /** Decimal-string mark price for the quote's market. */
  markPrice: string;
  positionType: PositionType;
  /** Original quote quantity, wei. */
  quantity: bigint;
  /** Already-closed quantity, wei. */
  closedAmount: bigint;
  /** Quote's opened price, wei. */
  openedPrice: bigint;
  /** Decimal-string leverage. Used for the percent term. */
  leverage: string;
}

/**
 * Return value of {@link calculateQuoteUpnl}.
 */
export interface CalculateQuoteUpnlReturnType {
  /** Unrealized PNL in collateral units, decimal string. `"0"` when no open size. */
  upnl: string;
  /** Decimal percent (e.g. `"12.34"`). `"0"` when indeterminate. */
  upnlPercent: string;
}

/**
 * Unrealized PNL for a single quote against the current mark price.
 *
 * - `openQty = quantity − closedAmount`
 * - `sideSign = positionType === SHORT ? -1 : 1`
 * - `upnl = openQty × (markPrice − openedPrice) × sideSign`
 * - `upnlPercent = upnl / openQty / openedPrice × leverage × 100`
 *   (only when `openQty > 0` and `openedPrice > 0`; else `"0"`).
 *
 * Price subtraction and amount multiplication retain 18-decimal bigint precision.
 * Returns `"0"` for any non-finite intermediate; the percent is presentation-rounded.
 *
 * @example
 * ```ts
 * const { upnl, upnlPercent } = calculateQuoteUpnl({
 *   markPrice: "0.0085",
 *   positionType: PositionType.LONG,
 *   quantity: 100n * 10n ** 18n,
 *   closedAmount: 0n,
 *   openedPrice: 80_000_000_000_000_000n,        // 0.08
 *   leverage: "10",
 * });
 * ```
 */
export function calculateQuoteUpnl(inputs: CalculateQuoteUpnlInputs): CalculateQuoteUpnlReturnType {
  const markPrice = Number(inputs.markPrice);
  const openedPrice = Number(formatUnits(inputs.openedPrice, WEI_DECIMALS));
  const openQty = Number(formatUnits(inputs.quantity - inputs.closedAmount, WEI_DECIMALS));
  const leverage = Number(inputs.leverage);
  const sideSign = inputs.positionType === PositionType.SHORT ? -1 : 1;

  if (!Number.isFinite(markPrice) || !Number.isFinite(openedPrice) || !Number.isFinite(openQty) || openQty <= 0) {
    return { upnl: "0", upnlPercent: "0" };
  }

  const markRaw = parseUnits(toDecimal(inputs.markPrice).toFixed(), WEI_DECIMALS);
  const upnlExact = formatUnits(
    ((inputs.quantity - inputs.closedAmount) * (markRaw - inputs.openedPrice) * BigInt(sideSign)) / 10n ** 18n,
    WEI_DECIMALS,
  );
  const upnl = Number(upnlExact);
  if (!Number.isFinite(upnl)) return { upnl: "0", upnlPercent: "0" };

  if (openedPrice <= 0 || !Number.isFinite(leverage)) {
    return { upnl: upnlExact, upnlPercent: "0" };
  }
  const upnlPercent = (upnl / openQty / openedPrice) * leverage * 100;
  if (!Number.isFinite(upnlPercent)) return { upnl: upnlExact, upnlPercent: "0" };

  return { upnl: upnlExact, upnlPercent: upnlPercent.toFixed(2) };
}
