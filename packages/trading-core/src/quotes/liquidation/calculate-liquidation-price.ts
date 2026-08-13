import { mulWei, WEI } from "../../shared/utils/wei";
import { PositionType } from "../../symmio-contracts/symmio/types";

/**
 * One open position attributed to an account (sub-account or virtual account).
 * Used by every aggregate calc that runs over an account's positions (currently
 * {@link calculateLiquidationPrice}; more to follow).
 *
 * Every field is 18-decimal wei `bigint`. `closedAmount` defaults to `0n` when
 * omitted; `openedPrice` is the settled fill price.
 */
export interface AccountPosition {
  /** Total quote quantity (wei). */
  quantity: bigint;
  /** Already-closed quantity (wei). Defaults to `0n`. */
  closedAmount?: bigint;
  /** Settled `openedPrice` (wei). */
  openedPrice: bigint;
}

/**
 * Inputs for {@link calculateLiquidationPrice}. All bigint fields are 18-decimal wei.
 */
export interface CalculateLiquidationPriceInputs {
  /** Active positions in the account (sub-account or virtual account). */
  positions: readonly AccountPosition[];
  /** Direction of the account's net position (LONG or SHORT). */
  positionType: PositionType;
  /** Account's allocated collateral, from `balanceInfoOfPartyA(account)`. */
  allocatedBalance: bigint;
  /** Account's locked CVA, from `balanceInfoOfPartyA(account)`. */
  lockedCVA: bigint;
  /** Account's locked LF, from `balanceInfoOfPartyA(account)`. */
  lockedLF: bigint;
}

/**
 * Liquidation price for an account (sub-account or virtual account), in
 * 18-decimal-wei collateral units. Aggregates the account's active positions:
 *
 * ```
 * freeBalance   = allocatedBalance − lockedCVA − lockedLF
 * openQty_i     = quantity_i − closedAmount_i
 * totalQty      = Σ openQty_i
 * totalNotional = Σ (openQty_i × openedPrice_i)
 *
 * LONG : liqPrice = (totalNotional − freeBalance) / totalQty
 * SHORT: liqPrice = (totalNotional + freeBalance) / totalQty
 * ```
 *
 * Returns `0n` when `totalQty` is `0n` or the computed price is `≤ 0n`
 * (typically meaning the account has no liquidation risk at any positive price).
 * All math is pure `bigint`, so there is no floating-point drift.
 *
 * @example
 * ```ts
 * const liq = calculateLiquidationPrice({
 *   positions: [{ quantity: 1_000_000_000_000_000_000n, openedPrice: 2_000_000_000_000_000_000n }],
 *   positionType: PositionType.LONG,
 *   allocatedBalance: 200_000_000_000_000_000_000n,
 *   lockedCVA: 10_000_000_000_000_000_000n,
 *   lockedLF: 5_000_000_000_000_000_000n,
 * });
 * ```
 */
export function calculateLiquidationPrice(inputs: CalculateLiquidationPriceInputs): bigint {
  let totalQty = 0n;
  let totalNotional = 0n;
  for (const position of inputs.positions) {
    const openQty = position.quantity - (position.closedAmount ?? 0n);
    if (openQty <= 0n) continue;
    totalQty += openQty;
    totalNotional += mulWei(openQty, position.openedPrice);
  }
  if (totalQty === 0n) return 0n;

  const freeBalance = inputs.allocatedBalance - inputs.lockedCVA - inputs.lockedLF;
  const numerator =
    inputs.positionType === PositionType.LONG ? totalNotional - freeBalance : totalNotional + freeBalance;

  const liquidationPrice = (numerator * WEI) / totalQty;
  return liquidationPrice > 0n ? liquidationPrice : 0n;
}
