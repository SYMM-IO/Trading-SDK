import { toDecimal } from "@symmio/utils/decimal";
import { SymmError } from "../../../shared/errors/symm-error";
import type { InstantOpenConstraintFields } from "./quote-constraints";
import { validateInstantOpenAgainstMarket } from "./quote-constraints";
import type {
  CalculateTradeParamsParameters,
  CalculateTradeParamsReturnType,
  ComputePlatformFeeRates,
} from "./trade-math";
import {
  calculateExpectedSettlementLoss,
  calculateMargin,
  calculateSolverFees,
  calculateTradeParams,
  computePlatformFeeLegs,
  SHORT_FUNDING_BUFFER_PERCENT,
} from "./trade-math";

/**
 * Safety headroom shaved off a full-balance position after it is sized to fit
 * the balance — `0.1%`. The sizing budgets settlement at the *expected* fill;
 * this epsilon (plus the maintenance-margin buffer already in `partyAmm`)
 * absorbs the gap when the actual fill lands a hair worse than the estimate,
 * so the funded VA never opens under-margined by a rounding hair.
 */
export const FULL_BALANCE_SAFETY_EPSILON_PERCENT = 0.1;

/**
 * Hard cap on the invariant step-down loop in
 * {@link sizeFullBalanceInstantOpen}. The linear rescale can overshoot by at
 * most a few quantity quanta (probe-side rounding), so hitting this cap means
 * the inputs are degenerate, not that more iterations would help.
 */
const MAX_STEP_DOWN_ITERATIONS = 25;

/**
 * Every cost leg an instant open charges, plus the `addMargin` amount that
 * funds them. All values are decimal strings.
 */
export interface InstantOpenCostLegs {
  /** Platform open fee: `getFeeForUser.openFee × notional / 1e18`. */
  platformOpenFee: string;
  /** Platform close fee, provisioned at open: `getFeeForUser.closeFee × notional / 1e18`. */
  platformCloseFee: string;
  /** Solver open fee (`hedgerFeeOpen × notional`). `"0"` on non-lowcap solvers. */
  openSolverFee: string;
  /** Worst-case solver close fee provisioned at open. `"0"` on non-lowcap solvers. */
  closeSolverFee: string;
  /** Side-aware `max(0, adverse fill deviation × quantity)`. `"0"` without a usable fill price. */
  expectedSettlementLoss: string;
  /**
   * The `addMargin` amount the sized trade needs: locked margin (SHORT: at the
   * buffered mark basis) plus every fee leg above.
   */
  marginAmount: string;
}

/**
 * Parameters for {@link computeInstantOpenCosts}.
 */
export interface ComputeInstantOpenCostsParameters {
  /** The sized trade the costs are computed for. */
  trade: CalculateTradeParamsReturnType;
  /** Position side. */
  positionType: CalculateTradeParamsParameters["positionType"];
  /** Mark price the order was sized at (decimal string). */
  markPrice: string;
  /** Expected fill price for the settlement provision; `undefined` provisions `"0"`. */
  expectedFillPrice: string | undefined;
  /** On-chain platform fee rates (`getFeeForUser`). */
  feeRates: ComputePlatformFeeRates;
  /** Lowcap adds the solver fee legs and the SHORT funding buffer; majors carry platform legs only. */
  isLowcap: boolean;
  /** Solver open-fee rate (decimal fraction string). Lowcap only. */
  hedgerFeeOpen?: string;
  /** Solver standard close-fee rate (decimal fraction string). Lowcap only. */
  hedgerFeeClose?: string;
  /** Early (peak) close-fee rate; when given the close leg provisions this worst case. */
  hedgerFeeCloseEarlyRate?: string;
  /** Early-window length in seconds (paired with `hedgerFeeCloseEarlyRate`). */
  hedgerFeeCloseEarlyThreshold?: number;
  /** Standard-rate threshold in seconds (paired with `hedgerFeeCloseEarlyRate`). */
  hedgerFeeCloseStandardThreshold?: number;
  /** Solver locked-param percents — needed for the SHORT buffered-basis recompute. */
  cvaPercent?: string;
  /** Solver locked-param percents. */
  lfPercent?: string;
  /** Solver locked-param percents. */
  partyAmmPercent?: string;
}

/**
 * Price every cost leg of a sized instant open and the `addMargin` amount that
 * funds them — the one shared cost model behind `prepareInstantOpenParams` and
 * `getInstantOpenFees`, so the preview equals what the open charges by
 * construction.
 *
 * Pure in `trade`: at a fixed fill price every leg scales linearly with the
 * sizing input (rates × notional, price delta × quantity, percents ×
 * notionalBasic), which is what lets {@link sizeFullBalanceInstantOpen} solve
 * the full-balance factor in one pass.
 */
export function computeInstantOpenCosts(parameters: ComputeInstantOpenCostsParameters): InstantOpenCostLegs {
  const { trade, positionType, markPrice, expectedFillPrice, feeRates, isLowcap } = parameters;

  const { platformOpenFee, platformCloseFee } = computePlatformFeeLegs(feeRates, trade.notional, trade.notional);
  const { openSolverFee, closeSolverFee } = isLowcap
    ? calculateSolverFees({
        notional: trade.notional,
        hedgerFeeOpen: parameters.hedgerFeeOpen,
        hedgerFeeClose: parameters.hedgerFeeClose,
        hedgerFeeCloseEarlyRate: parameters.hedgerFeeCloseEarlyRate,
        hedgerFeeCloseEarlyThreshold: parameters.hedgerFeeCloseEarlyThreshold,
        hedgerFeeCloseStandardThreshold: parameters.hedgerFeeCloseStandardThreshold,
      })
    : { openSolverFee: "0", closeSolverFee: "0" };
  const expectedSettlementLoss = calculateExpectedSettlementLoss({
    positionType,
    markPrice,
    expectedFillPrice,
    quantity: trade.quantity,
  });
  const marginAmount = calculateMargin({
    positionType,
    markPrice,
    quantityBasic: trade.quantityBasic,
    cva: trade.cva,
    lf: trade.lf,
    partyAmm: trade.partyAmm,
    openSolverFee,
    closeSolverFee,
    expectedSettlementLoss,
    platformFee: toDecimal(platformOpenFee).plus(platformCloseFee).toString(),
    /** Lowcap SHORT: fund lock growth above the floor. Majors keep the classic basis. */
    shortFundingBufferPercent: isLowcap ? SHORT_FUNDING_BUFFER_PERCENT : 0,
    cvaPercent: parameters.cvaPercent,
    lfPercent: parameters.lfPercent,
    partyAmmPercent: parameters.partyAmmPercent,
  });

  return { platformOpenFee, platformCloseFee, openSolverFee, closeSolverFee, expectedSettlementLoss, marginAmount };
}

/**
 * Parameters for {@link sizeFullBalanceInstantOpen}.
 */
export interface SizeFullBalanceInstantOpenParameters {
  /** The entire collateral to deploy into the VA, as a USD decimal string. */
  balance: string;
  /**
   * Trade-calc input with the final `slippage` resolved. `userInput` /
   * `inputField` are overridden internally (the balance is the sizing probe).
   * The position side, leverage, precisions, and locked-param percents are
   * read from here.
   */
  calculationInput: CalculateTradeParamsParameters;
  /**
   * Solver estimated fill price, when available. When `undefined` the
   * settlement leg is provisioned at the **slippage bound**
   * (`requestedOpenPrice` vs mark) instead of `"0"` — a full-balance open
   * deploys everything, so an unavailable estimate must fail safe, not
   * optimistic.
   */
  expectedFillPrice: string | undefined;
  /** On-chain platform fee rates (`getFeeForUser`). */
  feeRates: ComputePlatformFeeRates;
  /** Solver open-fee rate (decimal fraction string). */
  hedgerFeeOpen?: string;
  /** Solver standard close-fee rate (decimal fraction string). */
  hedgerFeeClose?: string;
  /** Early (peak) close-fee rate; when given the close leg provisions this worst case. */
  hedgerFeeCloseEarlyRate?: string;
  /** Early-window length in seconds (paired with `hedgerFeeCloseEarlyRate`). */
  hedgerFeeCloseEarlyThreshold?: number;
  /** Standard-rate threshold in seconds (paired with `hedgerFeeCloseEarlyRate`). */
  hedgerFeeCloseStandardThreshold?: number;
  /**
   * Market quote constraints. The sized quantity is snapped down to the lot
   * grid and validated against every published constraint; unpublished
   * (`"0"` / `0`) fields skip their check.
   */
  constraints: InstantOpenConstraintFields;
}

/**
 * Return type of {@link sizeFullBalanceInstantOpen}.
 */
export interface SizeFullBalanceInstantOpenReturnType {
  /** The final sized trade — lot-snapped, invariant-checked. */
  trade: CalculateTradeParamsReturnType;
  /** Cost legs of the final trade. `costs.marginAmount ≤ balance` is guaranteed. */
  costs: InstantOpenCostLegs;
}

/**
 * Size a full-balance instant open: the largest quantity whose locked margin +
 * fees + settlement provision fit inside `balance`, on the market's quantity
 * grid.
 *
 * Steps:
 * 1. **Probe** — run {@link calculateTradeParams} with the whole balance as
 *    margin input and price its costs. Every leg is linear in the sizing input
 *    at a fixed fill, so `balance / probeMargin` is the exact factor that makes
 *    the costs equal the balance.
 * 2. **Rescale** by that factor less {@link FULL_BALANCE_SAFETY_EPSILON_PERCENT}.
 * 3. **Snap** the rescaled quantity **down** to the market's lot grid (when
 *    published), rebuilding the locked values from the exact snapped quantity.
 * 4. **Invariant** — recompute the costs and, while `marginAmount > balance`,
 *    step the quantity down one grid step. The linear model only mispredicts
 *    through precision rounding (worth at most a few quanta), so this loop is
 *    short and guarantees the funded VA is never smaller than what the signed
 *    quote locks.
 * 5. **Validate** the final quantity against the market's published quote
 *    constraints.
 *
 * The settlement leg is provisioned at the expected fill when one exists, and
 * at the slippage bound otherwise — never at zero, because a full-balance open
 * leaves nothing behind to absorb an optimistic estimate. The estimate is
 * trusted only at or below the probe size it was quoted for: when the factor
 * would upsize past the probe (locks percents summing under 100), the sizing
 * re-solves with settlement at the slippage bound, or clamps to the probe
 * size when the bound model no longer upsizes.
 *
 * @throws {SymmError} `INVALID_TRADE_PARAMETERS` when the inputs cannot size a
 *   positive quantity whose costs fit the balance;
 *   `QUOTE_CONSTRAINT_VIOLATED` when the sized quantity violates a published
 *   market constraint.
 */
export function sizeFullBalanceInstantOpen(
  parameters: SizeFullBalanceInstantOpenParameters,
): SizeFullBalanceInstantOpenReturnType {
  const { balance, calculationInput, feeRates, constraints } = parameters;

  const probe = calculateTradeParams({ ...calculationInput, userInput: balance, inputField: "PRICE" });
  if (!probe) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "Invalid trade parameters: markPrice or balance is zero/NaN.",
    );
  }

  const costsContext = {
    positionType: calculationInput.positionType,
    markPrice: calculationInput.markPrice,
    feeRates,
    isLowcap: true,
    hedgerFeeOpen: parameters.hedgerFeeOpen,
    hedgerFeeClose: parameters.hedgerFeeClose,
    hedgerFeeCloseEarlyRate: parameters.hedgerFeeCloseEarlyRate,
    hedgerFeeCloseEarlyThreshold: parameters.hedgerFeeCloseEarlyThreshold,
    hedgerFeeCloseStandardThreshold: parameters.hedgerFeeCloseStandardThreshold,
    cvaPercent: calculationInput.cvaPercent,
    lfPercent: calculationInput.lfPercent,
    partyAmmPercent: calculationInput.partyAmmPercent,
  } as const;

  // Fail safe, not optimistic: without an estimate the settlement leg is
  // provisioned at the worst fill the signed price bound admits.
  const boundFillPrice = probe.requestedOpenPrice;
  let settlementFillPrice = parameters.expectedFillPrice ?? boundFillPrice;

  const probeMargin = toDecimal(
    computeInstantOpenCosts({ ...costsContext, expectedFillPrice: settlementFillPrice, trade: probe }).marginAmount,
  );
  // `Decimal(0).isPositive()` is true (zero carries a positive sign), so an
  // explicit lte(0) is required to keep a cost-free market from dividing to
  // Infinity below.
  if (probeMargin.isNaN() || probeMargin.lte(0)) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "sizeFullBalanceInstantOpen: could not size the full-balance open — the probe margin is zero or invalid.",
    );
  }

  const epsilonFactor = toDecimal(100 - FULL_BALANCE_SAFETY_EPSILON_PERCENT).div(100);
  let sizingFactor = toDecimal(balance).div(probeMargin).times(epsilonFactor);
  // The estimate was quoted at the probe size, so it only bounds fills at or
  // below it. A factor above 1 upsizes PAST the probe; there the estimate is
  // no longer conservative, so re-solve with settlement at the slippage bound
  // — and when even that stays above 1, upsize under the bound model. When
  // the bound model lands at or below the probe size, clamp to the probe size
  // instead, where the estimate is still valid.
  if (sizingFactor.gt(1) && parameters.expectedFillPrice !== undefined) {
    const probeMarginBound = toDecimal(
      computeInstantOpenCosts({ ...costsContext, expectedFillPrice: boundFillPrice, trade: probe }).marginAmount,
    );
    const boundFactor = toDecimal(balance).div(probeMarginBound).times(epsilonFactor);
    if (boundFactor.gt(1)) {
      sizingFactor = boundFactor;
      settlementFillPrice = boundFillPrice;
    } else {
      sizingFactor = epsilonFactor;
    }
  }
  const rescaled = calculateTradeParams({
    ...calculationInput,
    userInput: toDecimal(balance).times(sizingFactor).toString(),
    inputField: "PRICE",
  });
  if (!rescaled) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "sizeFullBalanceInstantOpen: the rescaled sizing input is zero/NaN — the balance is too small to open.",
    );
  }

  // Quantity grid: the lot size when the market publishes one, else the
  // quantity-precision quantum. Snap down — less quantity always needs less
  // margin, so down is the safe direction.
  const lotSize = toDecimal(constraints.lotSize);
  const hasLotGrid = !lotSize.isNaN() && lotSize.gt(0);
  const step = hasLotGrid ? lotSize : toDecimal(`1e-${calculationInput.quantityPrecision}`);

  let quantity = toDecimal(rescaled.quantity);
  if (hasLotGrid) quantity = quantity.minus(quantity.mod(lotSize));

  let trade = buildTradeFromQuantity(quantity.toString(), calculationInput, probe.requestedOpenPrice);
  let costs = computeInstantOpenCosts({ ...costsContext, expectedFillPrice: settlementFillPrice, trade });

  // Invariant: the funded VA must cover everything the signed quote locks. The
  // linear factor is exact up to precision rounding, so at most a few steps.
  for (let iteration = 0; toDecimal(costs.marginAmount).gt(balance); iteration++) {
    quantity = quantity.minus(step);
    if (quantity.lte(0) || iteration >= MAX_STEP_DOWN_ITERATIONS) {
      throw new SymmError(
        "validation",
        "INVALID_TRADE_PARAMETERS",
        "sizeFullBalanceInstantOpen: the balance cannot fund even the smallest quantity step on this market.",
      );
    }
    trade = buildTradeFromQuantity(quantity.toString(), calculationInput, probe.requestedOpenPrice);
    costs = computeInstantOpenCosts({ ...costsContext, expectedFillPrice: settlementFillPrice, trade });
  }

  const { ok, violations } = validateInstantOpenAgainstMarket({
    market: constraints,
    quantity: trade.quantity,
    markPrice: calculationInput.markPrice,
    cva: trade.cva,
    lf: trade.lf,
    partyAmm: trade.partyAmm,
  });
  if (!ok) {
    const summary = violations.map((violation) => violation.kind).join(", ");
    throw new SymmError(
      "validation",
      "QUOTE_CONSTRAINT_VIOLATED",
      `sizeFullBalanceInstantOpen: the sized quantity ${trade.quantity} violates market constraints: ${summary}.`,
    );
  }

  return { trade, costs };
}

/**
 * Rebuild a full trade-params shape from an exact leveraged quantity.
 *
 * Unlike {@link calculateTradeParams} (which floors `quantityBasic` first and
 * multiplies up), this derives `quantityBasic = quantity / leverage` at full
 * precision so the locked values stay exactly proportional to the wire
 * quantity — the solver re-derives its locks from the quantity it receives, so
 * a floored intermediate would disagree with it.
 */
function buildTradeFromQuantity(
  quantity: string,
  calculationInput: CalculateTradeParamsParameters,
  requestedOpenPrice: string,
): CalculateTradeParamsReturnType {
  const quantityBasic = toDecimal(quantity).div(calculationInput.leverage).toString();
  const notionalBasic = toDecimal(quantityBasic).times(requestedOpenPrice).toString();
  const percent = (value: string | undefined) => toDecimal(notionalBasic).times(toDecimal(value)).div(100).toString();
  return {
    requestedOpenPrice,
    quantityBasic,
    quantity,
    notionalBasic,
    notional: toDecimal(notionalBasic).times(calculationInput.leverage).toString(),
    cva: percent(calculationInput.cvaPercent),
    lf: percent(calculationInput.lfPercent),
    partyAmm: percent(calculationInput.partyAmmPercent),
    partyBmm: percent(calculationInput.partyBmmPercent),
  };
}
