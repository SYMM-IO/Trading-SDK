import { parseEther, RoundingMode, toDecimal } from "@symmio/utils/decimal";
import { calculateSolverCloseFee } from "../../shared/solver-close-fee";
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
 * Unix-seconds remaining for a LIMIT-order deadline (15 minutes). A resting
 * limit order lives longer than a market fill, so it gets a wider window.
 */
export const LIMIT_ORDER_DEADLINE_SECONDS = 900n;

/**
 * Compute a unix-seconds `deadline` for a LIMIT order (default 15 minutes).
 *
 * @param now - Optional override for `Math.floor(Date.now() / 1000)`. Useful for tests.
 */
export function getLimitOrderDeadline(now?: bigint): bigint {
  const base = now ?? BigInt(Math.floor(Date.now() / 1000));
  return base + LIMIT_ORDER_DEADLINE_SECONDS;
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
 * 2. `quantityBasic = userInput / markPrice` (when `inputField === "PRICE"`) or
 *    `userInput` (when `inputField === "TOKEN"`) trimmed to `quantityPrecision`.
 *    Sized at the raw mark price, never the slippage-adjusted bound: `V × L` of
 *    notional at mark `M` is `V × L / M` units on every fill, so changing the
 *    slippage setting moves only the price bound and never resizes the position.
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
      ? userInputDec.div(markPriceDec).toFixed(quantityPrecision, RoundingMode.ROUND_DOWN)
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
 * Solver fees charged on the position, funded from the VA at open.
 */
export interface SolverFees {
  /** `hedgerFeeOpen × notional`, decimal string. */
  openSolverFee: string;
  /**
   * Close-fee **estimate**, decimal string — the solver charges this at close
   * from the position, **not** funded by the open's `addMargin`. Reported at the
   * representative **standard** (floor) rate: `hedgerFeeClose × notional` (the
   * decay schedule evaluated at its standard threshold when the early fields are
   * supplied). It is an estimate, not the exact charge: the actual close fee is
   * priced from the real holding time at close and capped by the signed
   * `closeRateCap`.
   */
  closeSolverFee: string;
  /**
   * Static solver fee charged per instant open, decimal string — a flat USD
   * amount from the solver's `/info` config, **not** scaled by the notional.
   * `"0"` when the solver publishes none.
   */
  staticSolverFeeOpen: string;
  /**
   * Static solver close fee provisioned at open, decimal string — a flat USD
   * amount from the solver's `/info` config, **not** scaled by the notional.
   * `"0"` when the solver publishes none.
   */
  staticSolverFeeClose: string;
}

/**
 * Compute every fee the solver charges on an instant open: the rate legs on
 * the leveraged notional plus the flat static legs.
 *
 * The **open** legs (`openSolverFee`, `staticSolverFeeOpen`) are charged from
 * the VA at open, so they ride the `addMargin` transfer. The **close** legs
 * (`closeSolverFee`, `staticSolverFeeClose`) are charged at close from the
 * position — the contract collects them at close execution, not at open — so
 * they are returned as **estimates** for previews, not amounts the open funds.
 * The close-fee estimate uses the **standard** (floor) rate: when
 * `hedgerFeeCloseEarlyRate` is supplied the decay schedule is evaluated at its
 * standard threshold (which yields `hedgerFeeClose`), else it is the flat
 * `hedgerFeeClose × notional`. The static legs pass through as-is — flat USD
 * amounts, size-independent. An absent, NaN, or negative rate or static
 * contributes `"0"`.
 */
export function calculateSolverFees({
  notional,
  hedgerFeeOpen,
  hedgerFeeClose,
  hedgerFeeCloseEarlyRate,
  hedgerFeeCloseEarlyThreshold,
  hedgerFeeCloseStandardThreshold,
  staticSolverFeeOpen,
  staticSolverFeeClose,
}: {
  /** Leveraged notional (decimal string). */
  notional: string;
  /** Solver open-fee rate as a decimal fraction string (e.g. `"0.0004"`). */
  hedgerFeeOpen: string | undefined;
  /** Solver standard (floor) close-fee rate as a decimal fraction string — the close-fee estimate is priced at this rate. */
  hedgerFeeClose: string | undefined;
  /** Early (peak) close-fee rate; parametrizes the decay schedule the standard-rate estimate is read from. */
  hedgerFeeCloseEarlyRate?: string;
  /** Early-window length in seconds (paired with `hedgerFeeCloseEarlyRate`). */
  hedgerFeeCloseEarlyThreshold?: number;
  /** Standard-rate threshold in seconds (paired with `hedgerFeeCloseEarlyRate`) — the close-fee estimate is evaluated here. */
  hedgerFeeCloseStandardThreshold?: number;
  /** Static solver open fee — flat USD decimal string (solver `/info`). Defaults to `"0"`. */
  staticSolverFeeOpen?: string;
  /** Static solver close fee — flat USD decimal string (solver `/info`); an estimate charged at close, not funded at open. Defaults to `"0"`. */
  staticSolverFeeClose?: string;
}): SolverFees {
  const notionalDec = toDecimal(notional);
  const toFee = (rate: string | undefined) => {
    const rateDec = toDecimal(rate);
    if (rateDec.isNaN() || rateDec.isNegative() || notionalDec.isNaN()) return "0";
    return notionalDec.times(rateDec).toString();
  };
  /** Flat USD leg: passed through, not multiplied by the notional. */
  const toStaticFee = (value: string | undefined) => {
    const valueDec = toDecimal(value);
    return valueDec.isNaN() || valueDec.isNegative() ? "0" : valueDec.toString();
  };
  // Close-fee ESTIMATE at the STANDARD (floor) rate. The close fee is charged at
  // close from the position — not funded by the open's addMargin — so the
  // estimate reports the representative standard rate (the decay schedule read
  // at its standard threshold) rather than the worst-case early rate.
  const closeSolverFee =
    hedgerFeeCloseEarlyRate !== undefined
      ? calculateSolverCloseFee(
          {
            hedgerFeeClose: hedgerFeeClose ?? "0",
            hedgerFeeCloseEarlyRate,
            hedgerFeeCloseEarlyThreshold: hedgerFeeCloseEarlyThreshold ?? 0,
            hedgerFeeCloseStandardThreshold: hedgerFeeCloseStandardThreshold ?? 0,
          },
          { notional, holdingSeconds: hedgerFeeCloseStandardThreshold ?? 0 },
        )
      : toFee(hedgerFeeClose);
  return {
    openSolverFee: toFee(hedgerFeeOpen),
    closeSolverFee,
    staticSolverFeeOpen: toStaticFee(staticSolverFeeOpen),
    staticSolverFeeClose: toStaticFee(staticSolverFeeClose),
  };
}

/**
 * Expected settlement loss charged from the VA when the fill lands away from
 * the mark price the order was sized at.
 *
 * Side-aware: a LONG loses when the expected fill is **above** mark
 * (`(expectedFillPrice − markPrice) × quantity`), a SHORT when it is **below**
 * (`(markPrice − expectedFillPrice) × quantity`). Clamped at zero — a
 * favorable expected fill never shrinks the transfer. Returns `"0"` when no
 * usable estimate exists.
 */
export function calculateExpectedSettlementLoss({
  positionType,
  markPrice,
  expectedFillPrice,
  quantity,
}: {
  positionType: PositionType;
  /** Mark price the order was sized at (decimal string). */
  markPrice: string;
  /** Solver's estimated fill price (decimal string), when available. */
  expectedFillPrice: string | undefined;
  /** Leveraged order quantity (decimal string). */
  quantity: string;
}): string {
  if (expectedFillPrice === undefined) return "0";
  const mark = toDecimal(markPrice);
  const fill = toDecimal(expectedFillPrice);
  const quantityDec = toDecimal(quantity);
  if (mark.isNaN() || fill.isNaN() || fill.isZero() || quantityDec.isNaN()) return "0";

  const loss =
    positionType === PositionType.SHORT ? mark.minus(fill).times(quantityDec) : fill.minus(mark).times(quantityDec);
  return loss.isNegative() || loss.isNaN() ? "0" : loss.toString();
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
  /** Solver open fee funded from the VA (from {@link calculateSolverFees}). Defaults to `"0"`. */
  openSolverFee?: string;
  /**
   * Solver close fee (from {@link calculateSolverFees}). Defaults to `"0"`. The
   * instant-open flow leaves this at `0` — the close fee is charged at close
   * from the position, not funded here — and includes it only if a caller
   * deliberately chooses to reserve it.
   */
  closeSolverFee?: string;
  /** Expected settlement loss vs the estimated fill (from {@link calculateExpectedSettlementLoss}). Defaults to `"0"`. */
  expectedSettlementLoss?: string;
  /** Static solver open fee — flat USD, not rate × notional (from {@link calculateSolverFees}). Defaults to `"0"`. */
  staticSolverFeeOpen?: string;
  /**
   * Static solver close fee — flat USD (from {@link calculateSolverFees}).
   * Defaults to `"0"`. Like {@link CalculateMarginParameters.closeSolverFee},
   * the instant-open flow leaves this at `0`; it is charged at close.
   */
  staticSolverFeeClose?: string;
  /**
   * Extra funding headroom percent applied to a SHORT's margin basis
   * (`markPrice × (1 + percent/100)`). A SHORT's `requestedOpenPrice` is a
   * contract FLOOR — a fill above it rescales the signed locks up, so the
   * prefund needs headroom the signed values do not carry. Defaults to `0`;
   * the lowcap open flow passes {@link SHORT_FUNDING_BUFFER_PERCENT}.
   */
  shortFundingBufferPercent?: number;
}

/**
 * Funding headroom percent the lowcap open flow applies to a SHORT's margin
 * basis (see {@link CalculateMarginParameters.shortFundingBufferPercent}).
 */
export const SHORT_FUNDING_BUFFER_PERCENT = 1;

/**
 * Compute the `addMargin` amount for lowcap isolation.
 *
 * - **LONG**: `margin = cva + lf + partyAmm + fees`.
 * - **SHORT**: recompute the locked values at
 *   `markPrice × (1 + shortFundingBufferPercent/100)`, then sum + fees — the
 *   buffer covers lock growth when the fill lands above the SHORT's floor.
 *
 * `fees = platformFee + openSolverFee + closeSolverFee +
 * staticSolverFeeOpen + staticSolverFeeClose + expectedSettlementLoss` — the
 * sum of whatever legs the caller passes, funded from the **VA balance** via
 * the SubAccount → VA transfer. The instant-open flow passes only the
 * **open-side** legs plus the settlement provision (`platformFee` = the open
 * leg, `openSolverFee`, `staticSolverFeeOpen`, `expectedSettlementLoss`) and
 * leaves the close legs at `0`: close fees are charged at close from the
 * position, so pre-funding them would strand collateral. The static legs are
 * flat USD amounts and do not scale with the notional.
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
    openSolverFee = "0",
    closeSolverFee = "0",
    expectedSettlementLoss = "0",
    staticSolverFeeOpen = "0",
    staticSolverFeeClose = "0",
    shortFundingBufferPercent = 0,
  } = parameters;

  const fees = toDecimal(platformFee)
    .plus(openSolverFee)
    .plus(closeSolverFee)
    .plus(staticSolverFeeOpen)
    .plus(staticSolverFeeClose)
    .plus(expectedSettlementLoss);

  if (positionType === PositionType.LONG) {
    return toDecimal(cva).plus(lf).plus(partyAmm).plus(fees).toString();
  }

  const marginPrice = toDecimal(markPrice).times(toDecimal(100 + shortFundingBufferPercent).div(100));
  const notionalBasicMargin = toDecimal(quantityBasic).times(marginPrice).toString();
  const cvaMargin = toDecimal(notionalBasicMargin).times(toDecimal(cvaPercent)).div(100).toString();
  const lfMargin = toDecimal(notionalBasicMargin).times(toDecimal(lfPercent)).div(100).toString();
  const partyAmmMargin = toDecimal(notionalBasicMargin).times(toDecimal(partyAmmPercent)).div(100).toString();

  return toDecimal(cvaMargin).plus(lfMargin).plus(partyAmmMargin).plus(fees).toString();
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
 * The two platform-fee legs, separated. Their sum equals
 * {@link computePlatformFee} for the same inputs.
 */
export interface PlatformFeeLegs {
  /** `openFee × openNotional / 1e18`, decimal string. */
  platformOpenFee: string;
  /** `closeFee × closeNotional / 1e18`, decimal string — provisioned at open. */
  platformCloseFee: string;
}

/**
 * Compute the platform open and close fee legs separately.
 *
 * Same math as {@link computePlatformFee}, split per leg for fee-breakdown
 * displays. Rates come from on-chain `getFeeForUser` (18-decimal fixed-point).
 */
export function computePlatformFeeLegs(
  rates: ComputePlatformFeeRates,
  openNotional: string,
  closeNotional: string,
): PlatformFeeLegs {
  const scale = toDecimal("1e18");
  return {
    platformOpenFee: toDecimal(rates.openFee.toString()).times(openNotional).div(scale).toString(),
    platformCloseFee: toDecimal(rates.closeFee.toString()).times(closeNotional).div(scale).toString(),
  };
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
  /**
   * @deprecated No longer used and ignored. Close fees are charged at close from
   * the position, not reserved from the open budget, so the shave applies the
   * open fee only. Kept as an optional field so existing callers still compile.
   */
  closeFee?: bigint;
  /** Slippage as an 18-decimal fraction (5% → `5n * 10n ** 16n`). */
  slippageFractionWei: bigint;
  /** Requested leverage (integer ≥ 1). */
  leverage: number;
  /** LONG skips the slippage cap; SHORT applies it. */
  positionType: PositionType;
}

/**
 * Maximum initial margin an instant open can spend. Shaves the raw available
 * balance for the **open** fee (charged on the leveraged notional) and — for
 * SHORT only — a worst-case slippage-fill buffer. Pure `bigint`; clamps to `0n`.
 *
 * ```text
 * available = balance
 *           × max(0, 1 − slippageFactor)                 // SHORT: slippage, LONG: 0
 *           × max(0, 1 − leverage × openFee)
 * ```
 *
 * The close fee is **not** shaved: it is charged at close from the position, not
 * reserved from the open budget, so reserving it here would understate the max.
 *
 * A SHORT's `requestOpenPrice = markPrice × (1 − s)` is a contract FLOOR: a fill
 * above it rescales the signed locks by up to `1 / (1 − s)`, so capping usable
 * balance at `balance × (1 − s)` covers that growth. A LONG's request price is a
 * ceiling, so fills can only shrink the locks and need no cap.
 *
 * @returns spendable margin in 18-decimal wei.
 * @example
 * ```ts
 * const max = calculateAvailableInstantOpenMargin({
 *   balance,
 *   openFee,
 *   slippageFractionWei: 5n * 10n ** 16n, // 5%
 *   leverage: 10,
 *   positionType: PositionType.SHORT,
 * });
 * ```
 */
export function calculateAvailableInstantOpenMargin(parameters: CalculateAvailableInstantOpenMarginParameters): bigint {
  const { balance, openFee, slippageFractionWei, leverage, positionType } = parameters;
  const ONE_E18 = 10n ** 18n;

  const slippageMultiplier =
    positionType === PositionType.SHORT
      ? slippageFractionWei >= ONE_E18
        ? 0n
        : ONE_E18 - slippageFractionWei
      : ONE_E18;

  const leverageScaled = BigInt(leverage) * openFee;
  const feeMultiplier = leverageScaled >= ONE_E18 ? 0n : ONE_E18 - leverageScaled;

  const afterSlippage = (balance * slippageMultiplier) / ONE_E18;
  return (afterSlippage * feeMultiplier) / ONE_E18;
}
