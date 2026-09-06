import { toDecimal } from "@symmio/utils/decimal";
import type { SolverId } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { getEstimatedPrice } from "../../estimated-price/get-estimated-price";
import { PositionType } from "./types";

/**
 * Absorbs binary-float noise at the tolerance boundary, so a deviation sitting
 * exactly on the user's setting is not rejected by floating-point error.
 */
const BAND_EPSILON = 1e-9;

/**
 * Price bound sent when ASKING the solver for an open estimate — never a
 * trading bound. The solver treats `price` as a hard gate and rejects a bound
 * tighter than its fill instead of answering, while above that threshold the
 * answer does not move. A wide fixed bound keeps the estimate request always
 * answerable and keeps the estimate a pure function of quantity rather than of
 * the user's slippage setting.
 */
const OPEN_ESTIMATE_REQUEST_TOLERANCE = 0.5;

/**
 * Validate a user-supplied slippage percent before any network work.
 *
 * Accepts a finite number in `[0, 100)` — `0` is a legal "no tolerance"
 * choice; `100`+ would zero or invert a SHORT's price bound.
 *
 * @throws {SymmError} `INVALID_SLIPPAGE` when out of range.
 */
export function assertValidSlippage(slippage: number): void {
  if (typeof slippage !== "number" || !Number.isFinite(slippage) || slippage < 0 || slippage >= 100) {
    throw new SymmError(
      "validation",
      "INVALID_SLIPPAGE",
      `Invalid slippage "${String(slippage)}": expected a finite percent in [0, 100), e.g. 1 for 1%.`,
    );
  }
}

/**
 * Headroom applied on top of the estimated fill price when deriving an
 * automatic slippage ({@link deriveAutoSlippage}): the price bound is
 * `estimate × (1 ± 4%)`, covering drift between the solver's estimate and the
 * actual fill.
 */
const AUTO_SLIPPAGE_ESTIMATE_MARGIN = 0.04;

/** Fallback auto slippage percent when no usable estimate exists. */
const AUTO_SLIPPAGE_FALLBACK_PERCENT = 4;

/**
 * Parameters for {@link fetchOpenEstimatePrice}.
 */
export interface FetchOpenEstimatePriceParameters {
  chainId?: number;
  /** Solver whose dry-run estimate to read. Defaults to the chain's `defaultSolverId`. */
  solverId?: SolverId;
  /** Solver market id. */
  symbolId: number;
  /** Trade side. */
  positionType: PositionType;
  /** Leveraged order quantity (decimal string) — the size that will go on the wire. */
  quantity: string;
  /** Mark price the order was sized at (decimal string). */
  markPrice: string;
}

/**
 * Fetch the solver's expected fill price for an open, best-effort.
 *
 * Requests with the wide fixed bound ({@link OPEN_ESTIMATE_REQUEST_TOLERANCE})
 * so the solver's price gate never rejects the question. Returns `undefined`
 * instead of throwing when the estimate is unusable — network error,
 * non-Enigma solver, zero/NaN price, zero mark.
 */
export async function fetchOpenEstimatePrice(
  config: Config,
  parameters: FetchOpenEstimatePriceParameters,
): Promise<string | undefined> {
  const mark = toDecimal(parameters.markPrice);
  if (mark.isZero() || mark.isNaN()) return undefined;

  const requestPrice =
    parameters.positionType === PositionType.SHORT
      ? mark.times(1 - OPEN_ESTIMATE_REQUEST_TOLERANCE)
      : mark.times(1 + OPEN_ESTIMATE_REQUEST_TOLERANCE);

  let estimatedPrice: string;
  try {
    ({ estimatedPrice } = await getEstimatedPrice(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      symbolId: parameters.symbolId,
      quantity: parameters.quantity,
      positionType: parameters.positionType,
      entry: "open",
      price: requestPrice.toString(),
    }));
  } catch {
    return undefined;
  }

  const estimate = toDecimal(estimatedPrice);
  if (estimate.isZero() || estimate.isNaN()) return undefined;
  return estimatedPrice;
}

/**
 * Derive a slippage percent from the solver's expected fill price.
 *
 * The price bound is the estimate plus 4% headroom
 * ({@link AUTO_SLIPPAGE_ESTIMATE_MARGIN}) — `estimate × 1.04` for a LONG,
 * `estimate × 0.96` for a SHORT — re-expressed as a percent deviation from the
 * mark price (the basis `calculateTradeParams` applies slippage to). Clamped to
 * `[0, 99]` so the result always passes {@link assertValidSlippage}. Falls back
 * to a flat {@link AUTO_SLIPPAGE_FALLBACK_PERCENT}% when no usable estimate or
 * mark exists.
 */
export function deriveAutoSlippage({
  markPrice,
  expectedFillPrice,
  positionType,
}: {
  markPrice: string;
  expectedFillPrice: string | undefined;
  positionType: PositionType;
}): number {
  const mark = toDecimal(markPrice);
  if (mark.isZero() || mark.isNaN() || expectedFillPrice === undefined) return AUTO_SLIPPAGE_FALLBACK_PERCENT;
  const estimate = toDecimal(expectedFillPrice);
  if (estimate.isZero() || estimate.isNaN()) return AUTO_SLIPPAGE_FALLBACK_PERCENT;

  const percent =
    positionType === PositionType.SHORT
      ? toDecimal(1)
          .minus(estimate.times(1 - AUTO_SLIPPAGE_ESTIMATE_MARGIN).div(mark))
          .times(100)
      : estimate
          .times(1 + AUTO_SLIPPAGE_ESTIMATE_MARGIN)
          .div(mark)
          .minus(1)
          .times(100);

  return Math.min(99, Math.max(0, percent.toNumber()));
}

/**
 * Parameters for {@link assertOpenEstimateWithinSlippage}.
 */
export interface AssertOpenEstimateWithinSlippageParameters extends FetchOpenEstimatePriceParameters {
  /** User slippage tolerance percent (e.g. `5` for 5%). */
  slippage: number;
  /**
   * Pre-fetched expected fill price ({@link fetchOpenEstimatePrice}). When
   * supplied, the dry-run fetch is skipped and this value gates instead.
   */
  expectedFillPrice?: string;
}

/**
 * Dry-run the order and reject when the expected fill sits outside the user's
 * slippage tolerance.
 *
 * `expectedFillPrice` comes from `GET /estimated-price` (requested with a wide
 * fixed bound — see {@link OPEN_ESTIMATE_REQUEST_TOLERANCE}); the gate is
 *
 * ```text
 * |expectedFillPrice − markPrice| / markPrice > slippage/100 + ε → reject
 * ```
 *
 * A rejection here is a good estimate saying the market cannot fill within
 * tolerance — the solver would reject the order anyway, so failing early with a
 * clear error beats a wire round-trip ending in a solver error code.
 *
 * Best-effort by design: an unavailable estimate (network error, non-Enigma
 * solver, zero price) skips the gate rather than blocking the open — the
 * mark-sized order is always valid to submit.
 *
 * @throws {SymmError} `SLIPPAGE_EXCEEDED` when the estimated fill deviates
 *   from mark beyond the tolerance.
 */
export async function assertOpenEstimateWithinSlippage(
  config: Config,
  parameters: AssertOpenEstimateWithinSlippageParameters,
): Promise<void> {
  const mark = toDecimal(parameters.markPrice);
  if (mark.isZero() || mark.isNaN()) return;

  const estimatedPrice = parameters.expectedFillPrice ?? (await fetchOpenEstimatePrice(config, parameters));
  if (estimatedPrice === undefined) return;

  const expectedFillPrice = toDecimal(estimatedPrice);
  if (expectedFillPrice.isZero() || expectedFillPrice.isNaN()) return;

  const deviation = expectedFillPrice.minus(mark).abs().div(mark);
  if (deviation.gt(toDecimal(parameters.slippage).div(100).plus(BAND_EPSILON))) {
    throw new SymmError(
      "validation",
      "SLIPPAGE_EXCEEDED",
      `Estimated execution price ${estimatedPrice} deviates ${deviation.times(100).toFixed(4)}% from mark ${parameters.markPrice}, above the ${parameters.slippage}% slippage tolerance. Raise the tolerance or reduce the size.`,
    );
  }
}
