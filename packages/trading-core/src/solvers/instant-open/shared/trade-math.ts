import { parseEther, RoundingMode, toDecimal } from "@symmio/utils/decimal";
import { PositionType } from "./types";

/**
 * Unix-seconds remaining for a MARKET-order deadline (5 minutes).
 */
export const MARKET_ORDER_DEADLINE_SECONDS = 300n;

/**
 * Compute a unix-seconds `deadline` for a MARKET order.
 *
 * @param now - Optional override for `Math.floor(Date.now() / 1000)`. Useful for tests.
 */
export function getMarketOrderDeadline(now?: bigint): bigint {
  const base = now ?? BigInt(Math.floor(Date.now() / 1000));
  return base + MARKET_ORDER_DEADLINE_SECONDS;
}

/**
 * Parameters for {@link calculateTradeParams}.
 */
export interface CalculateTradeParamsParameters {
  /** Mark price as decimal string (e.g. `"50123.45"`). */
  markPrice: string;
  /** Slippage percent (e.g. `5` for 5%). */
  slippage: number;
  /** Position side: `"LONG"` or `"SHORT"`. */
  positionType: PositionType;
  /** User input as decimal string. Interpreted as collateral when `inputField === "PRICE"`. */
  userInput: string;
  /** Input mode. `"PRICE"` = userInput is USD collateral; `"TOKEN"` = userInput is base token amount. */
  inputField: "PRICE" | "TOKEN";
  /** Position leverage (integer ≥ 1). */
  leverage: number;
  /** Price precision (decimals). */
  pricePrecision: number;
  /** Quantity precision (decimals). */
  quantityPrecision: number;
  /** Solver locked-param percentages (e.g. `"0.02"` for 2%). */
  cvaPercent?: string;
  /** Solver locked-param percentages (e.g. `"0.01"` for 1%). */
  lfPercent?: string;
  /** Solver locked-param percentages. */
  partyAmmPercent?: string;
  /** Solver locked-param percentages. */
  partyBmmPercent?: string;
}

/**
 * Return type of {@link calculateTradeParams}.
 *
 * All values are decimal strings. Convert to 18-decimal `bigint` with
 * `parseEther(...).toFixed(0)` (or {@link toWeiBigInt}) before passing to a
 * contract call.
 */
export interface CalculateTradeParamsReturnType {
  /** Open price with slippage applied, trimmed to `pricePrecision`. */
  requestedOpenPrice: string;
  /** Base quantity (no leverage), trimmed to `quantityPrecision`. */
  quantityBasic: string;
  /** Leveraged quantity (`quantityBasic × leverage`), trimmed to `quantityPrecision`. */
  quantity: string;
  /** Base notional (`quantityBasic × requestedOpenPrice`). */
  notionalBasic: string;
  /** Leveraged notional (`notionalBasic × leverage`). */
  notional: string;
  /** CVA locked margin (`notionalBasic × cvaPercent / 100`). */
  cva: string;
  /** LF locked margin (`notionalBasic × lfPercent / 100`). */
  lf: string;
  /** PartyA maintenance margin. */
  partyAmm: string;
  /** PartyB maintenance margin. */
  partyBmm: string;
}

/**
 * Pure trade-parameters calculator for lowcap MARKET orders.
 *
 * Steps:
 * 1. `requestedOpenPrice = markPrice × (1 ± slippage/100)` trimmed to `pricePrecision`.
 * 2. `quantityBasic = userInput / requestedOpenPrice` (when `inputField === "PRICE"`) or
 *    `userInput` (when `inputField === "TOKEN"`) trimmed to `quantityPrecision`.
 * 3. `notionalBasic = quantityBasic × requestedOpenPrice`.
 * 4. `cva / lf / partyAmm / partyBmm = notionalBasic × percent / 100`.
 * 5. `quantity = quantityBasic × leverage` trimmed to `quantityPrecision`.
 * 6. `notional = notionalBasic × leverage`.
 *
 * @returns `null` when `markPrice` is zero/NaN or `userInput` is invalid.
 */
export function calculateTradeParams(
  parameters: CalculateTradeParamsParameters,
): CalculateTradeParamsReturnType | null {
  const {
    markPrice,
    slippage,
    positionType,
    userInput,
    inputField,
    leverage,
    pricePrecision,
    quantityPrecision,
    cvaPercent,
    lfPercent,
    partyAmmPercent,
    partyBmmPercent,
  } = parameters;

  const markPriceDec = toDecimal(markPrice);
  if (markPriceDec.isZero() || markPriceDec.isNaN()) return null;
  const userInputDec = toDecimal(userInput);
  if (userInputDec.isZero() || userInputDec.isNaN()) return null;

  const signedSlippage = positionType === PositionType.SHORT ? slippage : -slippage;
  const slippageFactor = toDecimal(100 - signedSlippage).div(100);
  const requestedOpenPrice = markPriceDec.times(slippageFactor).toFixed(pricePrecision, RoundingMode.ROUND_DOWN);

  const quantityBasic =
    inputField === "PRICE"
      ? userInputDec.div(requestedOpenPrice).toFixed(quantityPrecision, RoundingMode.ROUND_DOWN)
      : userInputDec.toFixed(quantityPrecision, RoundingMode.ROUND_DOWN);

  const notionalBasic = toDecimal(quantityBasic).times(requestedOpenPrice).toString();
  const cva = toDecimal(notionalBasic).times(toDecimal(cvaPercent)).div(100).toString();
  const lf = toDecimal(notionalBasic).times(toDecimal(lfPercent)).div(100).toString();
  const partyAmm = toDecimal(notionalBasic).times(toDecimal(partyAmmPercent)).div(100).toString();
  const partyBmm = toDecimal(notionalBasic).times(toDecimal(partyBmmPercent)).div(100).toString();

  const quantity = toDecimal(quantityBasic).times(leverage).toFixed(quantityPrecision, RoundingMode.ROUND_DOWN);
  const notional = toDecimal(notionalBasic).times(leverage).toString();

  return {
    requestedOpenPrice,
    quantityBasic,
    quantity,
    notionalBasic,
    notional,
    cva,
    lf,
    partyAmm,
    partyBmm,
  };
}

/**
 * Parameters for {@link calculateMargin}.
 */
export interface CalculateMarginParameters {
  /** Position side. */
  positionType: PositionType;
  /** Mark price (decimal string). */
  markPrice: string;
  /** Base quantity from {@link calculateTradeParams}. */
  quantityBasic: string;
  /** CVA from {@link calculateTradeParams}. */
  cva: string;
  /** LF from {@link calculateTradeParams}. */
  lf: string;
  /** PartyA maintenance margin from {@link calculateTradeParams}. */
  partyAmm: string;
  /** Solver locked-param percents (passed when recomputing for SHORT). */
  cvaPercent?: string;
  /** Solver locked-param percents. */
  lfPercent?: string;
  /** Solver locked-param percents. */
  partyAmmPercent?: string;
  /** On-chain platform fee as decimal string (from {@link computePlatformFee}). */
  platformFee: string;
}

/**
 * Compute the `addMargin` amount for lowcap isolation.
 *
 * - **LONG**: `margin = cva + lf + partyAmm + platformFee`.
 * - **SHORT**: recompute the locked values at `markPrice`,
 *   then sum + `platformFee`.
 *
 * @returns Margin as decimal string.
 */
export function calculateMargin(parameters: CalculateMarginParameters): string {
  const {
    positionType,
    markPrice,
    quantityBasic,
    cva,
    lf,
    partyAmm,
    cvaPercent,
    lfPercent,
    partyAmmPercent,
    platformFee,
  } = parameters;

  if (positionType === PositionType.LONG) {
    return toDecimal(cva).plus(lf).plus(partyAmm).plus(platformFee).toString();
  }

  const marginPrice = toDecimal(markPrice);
  const notionalBasicMargin = toDecimal(quantityBasic).times(marginPrice).toString();
  const cvaMargin = toDecimal(notionalBasicMargin).times(toDecimal(cvaPercent)).div(100).toString();
  const lfMargin = toDecimal(notionalBasicMargin).times(toDecimal(lfPercent)).div(100).toString();
  const partyAmmMargin = toDecimal(notionalBasicMargin).times(toDecimal(partyAmmPercent)).div(100).toString();

  return toDecimal(cvaMargin).plus(lfMargin).plus(partyAmmMargin).plus(platformFee).toString();
}

/**
 * On-chain `getFeeForUser` result, in 18-decimal fixed-point.
 */
export interface ComputePlatformFeeRates {
  /** Open fee rate as 18-decimal `bigint`. */
  openFee: bigint;
  /** Close fee rate as 18-decimal `bigint`. */
  closeFee: bigint;
}

/**
 * Compute the total platform fee for an open + close round trip.
 *
 * `(openFee × initialNotional + closeFee × closeNotional) / 1e18`.
 *
 * @param rates - Fee rates from `getFeeForUser`.
 * @param initialNotional - Notional at open, decimal string.
 * @param closeNotional - Notional at close, decimal string.
 * @returns Total fee as decimal string.
 */
export function computePlatformFee(
  rates: ComputePlatformFeeRates,
  initialNotional: string,
  closeNotional: string,
): string {
  const open = toDecimal(rates.openFee.toString()).times(initialNotional);
  const close = toDecimal(rates.closeFee.toString()).times(closeNotional);
  return open.plus(close).div(toDecimal("1e18")).toString();
}

/**
 * Convert a decimal string to an 18-decimal-fixed-point `bigint`.
 *
 * Wrapper over `parseEther` from `@symmio/utils/decimal` that returns
 * the wei value as `bigint` (truncated, no rounding) suitable for contract calls.
 */
export function toWeiBigInt(value: string): bigint {
  return BigInt(parseEther(value).toFixed(0, RoundingMode.ROUND_DOWN));
}

/**
 * Inputs for {@link calculateAvailableInstantOpenMargin}. All amounts are
 * 18-decimal wei / fixed-point.
 */
export interface CalculateAvailableInstantOpenMarginParameters {
  /** SubAccount available (deallocated) balance from `getAccountBalanceOf`; 1e18-scaled. */
  balance: bigint;
  /** Open fee rate (18-decimal fixed-point) from `getFeeForUser`. */
  openFee: bigint;
  /** Close fee rate (18-decimal fixed-point) from `getFeeForUser`. */
  closeFee: bigint;
  /** Slippage as an 18-decimal fraction (5% → `5n * 10n ** 16n`). */
  slippageFractionWei: bigint;
  /** Requested leverage (integer ≥ 1). */
  leverage: number;
  /** LONG skips the slippage cap; SHORT applies it. */
  positionType: PositionType;
}

/**
 * Maximum initial margin an instant open can spend. Shaves the raw available
 * balance for fees (both sides, charged on the leveraged notional) and — for
 * SHORT only — a worst-case slippage-fill buffer. Pure `bigint`; clamps to `0n`.
 *
 * ```text
 * available = balance
 *           × max(0, 1 − slippageFactor)                 // SHORT: slippage, LONG: 0
 *           × max(0, 1 − leverage × (openFee + closeFee))
 * ```
 *
 * A SHORT sizes quantity off `requestOpenPrice = markPrice × (1 − s)` (below
 * mark), so a worse fill inflates notional by up to `1 / (1 − s)`; capping usable
 * balance at `balance × (1 − s)` covers it. A LONG sets the request above mark,
 * so fills deflate notional and need no cap.
 *
 * @returns spendable margin in 18-decimal wei.
 * @example
 * ```ts
 * const max = calculateAvailableInstantOpenMargin({
 *   balance,
 *   openFee,
 *   closeFee,
 *   slippageFractionWei: 5n * 10n ** 16n, // 5%
 *   leverage: 10,
 *   positionType: PositionType.SHORT,
 * });
 * ```
 */
export function calculateAvailableInstantOpenMargin(parameters: CalculateAvailableInstantOpenMarginParameters): bigint {
  const { balance, openFee, closeFee, slippageFractionWei, leverage, positionType } = parameters;
  const ONE_E18 = 10n ** 18n;

  const slippageMultiplier =
    positionType === PositionType.SHORT
      ? slippageFractionWei >= ONE_E18
        ? 0n
        : ONE_E18 - slippageFractionWei
      : ONE_E18;

  const leverageScaled = BigInt(leverage) * (openFee + closeFee);
  const feeMultiplier = leverageScaled >= ONE_E18 ? 0n : ONE_E18 - leverageScaled;

  const afterSlippage = (balance * slippageMultiplier) / ONE_E18;
  return (afterSlippage * feeMultiplier) / ONE_E18;
}
