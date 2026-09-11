import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import { decimalPriceToWei } from "../../../shared/utils/price";
import type { FeeForUser } from "../../../symmio-contracts/symmio/actions/get-fee-for-user";
import type { ApiLockedParamsBySymbolIdResponse } from "../../types/generated/enigma-solver";
import type { InstantOpenParameters } from "../instant-open/types";
import {
  assertOpenEstimateWithinSlippage,
  assertValidSlippage,
  deriveAutoSlippage,
  fetchOpenEstimatePrice,
} from "../shared/open-estimate-guard";
import {
  calculateExpectedSettlementLoss,
  calculateMargin,
  calculateSolverFees,
  calculateTradeParams,
  computePlatformFee,
  SHORT_FUNDING_BUFFER_PERCENT,
  toWeiBigInt,
} from "../shared/trade-math";
import { type InstantOpenMarketData, type PositionType } from "../shared/types";
import { resolveFeeRates, resolveLockedParams, resolveMarket, resolveMarkPrice } from "./resolvers";

/**
 * Default solver-fee rate cap when the market publishes none: `"0.01"` — 1% of
 * notional, as a decimal ratio. Applied per side before wei conversion.
 */
const DEFAULT_SOLVER_FEE_CAP = "0.01";

/**
 * Convert a market's solver-fee cap ratio string to its 18-decimal wei value.
 *
 * An absent cap falls back to {@link DEFAULT_SOLVER_FEE_CAP}; a present but
 * malformed string **throws** rather than silently signing zero caps — the caps
 * are immutable once `sendQuote` lands, so a bad vendor string must surface
 * before the signature, not after.
 *
 * @throws {SymmError} `INVALID_SOLVER_FEE_CAP` when the string does not parse.
 */
function solverFeeCapToWei(field: "minOpenSolverFeeCap" | "minCloseSolverFeeCap", value: string | undefined): bigint {
  const cap = decimalPriceToWei(value ?? DEFAULT_SOLVER_FEE_CAP);
  if (cap === undefined) {
    throw new SymmError(
      "validation",
      "INVALID_SOLVER_FEE_CAP",
      `prepareInstantOpenParams: market ${field} "${value}" is not a valid decimal ratio.`,
    );
  }
  return cap;
}

/**
 * Parameters for {@link prepareInstantOpenParams} and `instantOpenAuto`.
 *
 * Required = inputs only the caller can know (wallet, session key, trade
 * intent). Optional = anything derivable from solver / price-service / on-chain
 * reads. Pre-fill an optional field to skip its fetch.
 */
export type PrepareInstantOpenParameters = Compute<
  WriteSolverParameter & {
    /** Sub-account / partyA address. */
    subAccountAddress: Address;
    /** Market identification + optional pre-fetched precision metadata. */
    market: InstantOpenMarketData;
    /** Trade side. */
    positionType: PositionType;
    /** Collateral (USD) the user enters as initial margin. Decimal string. */
    initialMargin: string;
    /** Position leverage (integer ≥ 1). */
    leverage: number;
    /**
     * Slippage tolerance percent (e.g. `5` for 5%). **Required on majors
     * (non-lowcap) solvers.** On a lowcap solver it may be omitted to
     * auto-derive: the SDK dry-runs the sized order and sets the price bound
     * to the estimated fill price plus 4% headroom (falling back to a flat 4%
     * off mark when the estimate is unavailable).
     */
    slippage?: number;
    /** Pre-fetched mark price as decimal string. When omitted, fetched via Enigma price service. */
    markPrice?: string;
    /**
     * Pre-fetched solver estimated open (fill) price as decimal string —
     * **lowcap/Enigma only**; ignored on any other solver kind. When omitted
     * on a lowcap solver, fetched via `GET /estimated-price`. Feeds the
     * settlement-loss provision, the slippage gate, and (when `slippage` is
     * omitted) the auto-slippage derivation.
     */
    estimatedOpenPrice?: string;
    /**
     * Pre-fetched solver locked params (matches `getLockedParams` return —
     * `ApiLockedParamsBySymbolIdResponse`). When supplied with all four
     * percent fields, the fetch is skipped.
     */
    lockedParamPercent?: ApiLockedParamsBySymbolIdResponse;
    /**
     * Pre-fetched on-chain fee rates (matches `getFeeForUser` return —
     * `FeeForUser`). When omitted, fetched via `getFeeForUser`.
     */
    feeRates?: FeeForUser;
    /** Forwarded to {@link InstantOpenParameters}. */
    uuid?: string;
    /** Forwarded to {@link InstantOpenParameters}. */
    addMarginSalt?: Hex;
    /** Forwarded to {@link InstantOpenParameters}. */
    sendQuoteSalt?: Hex;
    /** Forwarded to {@link InstantOpenParameters}. */
    deadline?: bigint;
  }
>;

/**
 * Resolve every input the {@link InstantOpenParameters} primitive needs from a
 * minimal parameter set.
 *
 * The estimate-driven steps (auto slippage, dry-run gate, solver fees,
 * settlement provision) are **lowcap-only** — a majors (non-lowcap) prepare is
 * unchanged: `slippage` required, no estimate fetch, margin = locks +
 * platform fee.
 *
 * Steps:
 * 1. Validate the user's `slippage` ({@link assertValidSlippage}). On a
 *    lowcap solver it may be omitted and is auto-derived: dry-run the
 *    mark-sized order and set the price bound to the estimated fill plus 4%
 *    headroom ({@link deriveAutoSlippage}). On majors an omitted slippage
 *    throws `SLIPPAGE_REQUIRED`.
 * 2. Resolve market metadata, mark price, locked params, and fee rates —
 *    concurrent fetches with caller-supplied fields short-circuiting.
 * 3. Run {@link calculateTradeParams} to derive `requestedOpenPrice`,
 *    `quantity`, `cva`, `lf`, `partyAmm`, `partyBmm`, `notional`.
 * 4. Dry-run the sized order and reject when the expected fill deviates from
 *    mark beyond the slippage tolerance
 *    ({@link assertOpenEstimateWithinSlippage}; skipped when the estimate is
 *    unavailable, reusing the caller-supplied `estimatedOpenPrice` or the
 *    auto-slippage estimate when one exists).
 * 5. Run {@link computePlatformFee}, {@link calculateSolverFees}, and
 *    {@link calculateExpectedSettlementLoss}, then {@link calculateMargin} to
 *    derive the `addMargin` amount — the solver charges its fees and the
 *    open-price settlement from the VA, so the transfer funds
 *    `locks + platformFee + openSolverFee + closeSolverFee +
 *    expectedSettlementLoss`.
 * 6. Convert all final values to 18-decimal-wei `bigint`.
 *
 * @throws {SymmError} `INVALID_SLIPPAGE` / `SLIPPAGE_REQUIRED` /
 *   `SLIPPAGE_EXCEEDED` /
 *   `RESOLVE_MARKET_NOT_FOUND` /
 *   `RESOLVE_MARKET_METADATA_INCOMPLETE` /
 *   `RESOLVE_MARK_PRICE_NOT_FOUND` / `INVALID_TRADE_PARAMETERS` /
 *   `INVALID_SOLVER_FEE_CAP` for invalid inputs or an out-of-tolerance fill.
 */
export async function prepareInstantOpenParams(
  config: Config,
  parameters: PrepareInstantOpenParameters,
): Promise<InstantOpenParameters> {
  // Reject a malformed user slippage before any network work. An omitted
  // slippage is auto-derived from the dry-run estimate after sizing.
  if (parameters.slippage !== undefined) assertValidSlippage(parameters.slippage);

  /**
   * The estimate-driven behaviors — auto slippage, the dry-run gate, solver
   * fees, and the settlement provision — exist only on lowcap (Enigma)
   * solvers. On majors the flow is unchanged: slippage is required, no
   * estimate is fetched, and the margin carries locks + platform fee only.
   */
  const isLowcap = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId }).id === "enigma";
  if (parameters.slippage === undefined && !isLowcap) {
    throw new SymmError(
      "validation",
      "SLIPPAGE_REQUIRED",
      "prepareInstantOpenParams: slippage is required on this solver — auto-derived slippage is lowcap-only.",
    );
  }

  /** Fee caps only exist on the v0.8.6 quote API — don't force a market fetch for them on a legacy chain. */
  const needsSolverFeeCaps = config.getChainConfig(parameters.chainId).contractsVersion === "0.8.6";

  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
    minOpenSolverFeeCap: parameters.market.minOpenSolverFeeCap,
    minCloseSolverFeeCap: parameters.market.minCloseSolverFeeCap,
    includeSolverFeeCaps: needsSolverFeeCaps,
    hedgerFeeOpen: parameters.market.hedgerFeeOpen,
    hedgerFeeClose: parameters.market.hedgerFeeClose,
    hedgerFeeCloseEarlyRate: parameters.market.hedgerFeeCloseEarlyRate,
    hedgerFeeCloseEarlyThreshold: parameters.market.hedgerFeeCloseEarlyThreshold,
    hedgerFeeCloseStandardThreshold: parameters.market.hedgerFeeCloseStandardThreshold,
    /** Lowcap only: the solver charges its fees from the VA, so `addMargin` must fund them. */
    includeHedgerFees: isLowcap,
  });
  const [markPrice, lockedParams, feeRates] = await Promise.all([
    resolveMarkPrice(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      marketName: market.name,
      markPrice: parameters.markPrice,
    }),
    resolveLockedParams(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      marketName: market.name,
      leverage: parameters.leverage,
      lockedParamPercent: parameters.lockedParamPercent,
    }),
    resolveFeeRates(config, {
      chainId: parameters.chainId,
      subAccountAddress: parameters.subAccountAddress,
      marketId: parameters.market.id,
      feeRates: parameters.feeRates,
    }),
  ]);

  const calculationInput = {
    markPrice,
    positionType: parameters.positionType,
    userInput: parameters.initialMargin,
    inputField: "PRICE" as const,
    leverage: parameters.leverage,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
    cvaPercent: lockedParams.cva,
    lfPercent: lockedParams.lf,
    partyAmmPercent: lockedParams.partyAmm,
    partyBmmPercent: lockedParams.partyBmm,
  };

  // Auto slippage: dry-run the mark-sized order (quantity is slippage-
  // independent) and set the price bound to the estimated fill plus 4%
  // headroom, re-expressed as a percent off mark. A caller-supplied
  // `estimatedOpenPrice` short-circuits the fetch; either way the estimate is
  // reused by the gate and the settlement provision so the solver is asked at
  // most once.
  let slippage = parameters.slippage;
  let expectedFillPrice = isLowcap ? parameters.estimatedOpenPrice : undefined;
  if (slippage === undefined) {
    const sized = calculateTradeParams({ ...calculationInput, slippage: 0 });
    if (!sized) {
      throw new SymmError(
        "validation",
        "INVALID_TRADE_PARAMETERS",
        "Invalid trade parameters: markPrice or initialMargin is zero/NaN.",
      );
    }
    if (isLowcap && expectedFillPrice === undefined) {
      expectedFillPrice = await fetchOpenEstimatePrice(config, {
        chainId: parameters.chainId,
        solverId: parameters.solverId,
        symbolId: parameters.market.id,
        positionType: parameters.positionType,
        quantity: sized.quantity,
        markPrice,
      });
    }
    slippage = deriveAutoSlippage({ markPrice, expectedFillPrice, positionType: parameters.positionType });
  }

  const tradeCalc = calculateTradeParams({ ...calculationInput, slippage });
  if (!tradeCalc) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "Invalid trade parameters: markPrice or initialMargin is zero/NaN.",
    );
  }

  // The expected fill price funds the settlement-loss provision and feeds the
  // slippage gate. Fetch it once here when neither the caller nor the
  // auto-slippage path supplied it — pass `estimatedOpenPrice` to skip the
  // round-trip on latency-sensitive submits.
  if (isLowcap && expectedFillPrice === undefined) {
    expectedFillPrice = await fetchOpenEstimatePrice(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      symbolId: parameters.market.id,
      positionType: parameters.positionType,
      quantity: tradeCalc.quantity,
      markPrice,
    });
  }

  // Dry-run gate: reject early when the expected fill deviates from mark
  // beyond the user's slippage — the solver would reject the quote anyway.
  // Best-effort: an unavailable estimate skips the gate, never blocks the open.
  if (expectedFillPrice !== undefined) {
    await assertOpenEstimateWithinSlippage(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      symbolId: parameters.market.id,
      positionType: parameters.positionType,
      quantity: tradeCalc.quantity,
      markPrice,
      slippage,
      expectedFillPrice,
    });
  }

  const platformFee = computePlatformFee(feeRates, tradeCalc.notional, tradeCalc.notional);
  // Lowcap: the solver charges its fees and the open-price settlement from the
  // VA balance — the addMargin transfer moves those funds from the SubAccount.
  // Majors carry neither leg; their margin stays locks + platform fee.
  const { openSolverFee, closeSolverFee } = isLowcap
    ? calculateSolverFees({
        notional: tradeCalc.notional,
        hedgerFeeOpen: market.hedgerFeeOpen,
        hedgerFeeClose: market.hedgerFeeClose,
        hedgerFeeCloseEarlyRate: market.hedgerFeeCloseEarlyRate,
        hedgerFeeCloseEarlyThreshold: market.hedgerFeeCloseEarlyThreshold,
        hedgerFeeCloseStandardThreshold: market.hedgerFeeCloseStandardThreshold,
      })
    : { openSolverFee: "0", closeSolverFee: "0" };
  const expectedSettlementLoss = calculateExpectedSettlementLoss({
    positionType: parameters.positionType,
    markPrice,
    expectedFillPrice,
    quantity: tradeCalc.quantity,
  });
  const marginAmount = calculateMargin({
    positionType: parameters.positionType,
    markPrice,
    quantityBasic: tradeCalc.quantityBasic,
    cva: tradeCalc.cva,
    lf: tradeCalc.lf,
    partyAmm: tradeCalc.partyAmm,
    openSolverFee,
    closeSolverFee,
    expectedSettlementLoss,
    /** Lowcap SHORT: fund lock growth above the floor. Majors keep the classic basis. */
    shortFundingBufferPercent: isLowcap ? SHORT_FUNDING_BUFFER_PERCENT : 0,
    cvaPercent: lockedParams.cva,
    lfPercent: lockedParams.lf,
    partyAmmPercent: lockedParams.partyAmm,
    platformFee,
  });

  return {
    chainId: parameters.chainId,
    /**
     * Carried through deliberately: `instantOpen` resolves the solver from it to
     * fill `partyBsWhiteList` — which is signed into the EIP-712 payload — and to
     * pick the submit URL. Dropping it here would sign against the default
     * solver's address while the quote was priced and sized for another.
     */
    solverId: parameters.solverId,
    from: parameters.from,
    subAccountAddress: parameters.subAccountAddress,
    marketId: parameters.market.id,
    positionType: parameters.positionType,
    order: {
      price: toWeiBigInt(tradeCalc.requestedOpenPrice),
      quantity: toWeiBigInt(tradeCalc.quantity),
    },
    lockedParam: {
      cva: toWeiBigInt(tradeCalc.cva),
      lf: toWeiBigInt(tradeCalc.lf),
      partyAmm: toWeiBigInt(tradeCalc.partyAmm),
      partyBmm: toWeiBigInt(tradeCalc.partyBmm),
    },
    margin: {
      amount: toWeiBigInt(marginAmount),
    },
    /** Only meaningful on a v0.8.6 chain — absent on v0.8.5, whose flow signs the legacy call. */
    ...(needsSolverFeeCaps
      ? {
          solverFeeCaps: {
            openRateCap: solverFeeCapToWei("minOpenSolverFeeCap", market.minOpenSolverFeeCap),
            closeRateCap: solverFeeCapToWei("minCloseSolverFeeCap", market.minCloseSolverFeeCap),
          },
        }
      : {}),
    uuid: parameters.uuid,
    addMarginSalt: parameters.addMarginSalt,
    sendQuoteSalt: parameters.sendQuoteSalt,
    deadline: parameters.deadline,
  };
}
