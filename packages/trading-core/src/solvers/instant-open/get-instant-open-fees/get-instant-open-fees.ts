import { toDecimal } from "@symmio/utils/decimal";
import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import type { FeeForUser } from "../../../symmio-contracts/symmio/actions/get-fee-for-user";
import type { EnigmaSolverInfo } from "../../get-solver-info";
import type { ApiLockedParamsBySymbolIdResponse } from "../../types/generated/enigma-solver";
import type { FullBalanceFunding } from "../prepare-instant-open-params";
import {
  resolveFeeRates,
  resolveLockedParams,
  resolveMarket,
  resolveMarkPrice,
  resolveSolverInfo,
} from "../prepare-instant-open-params/resolvers";
import { sizeFullBalanceInstantOpen } from "../shared/full-balance-sizing";
import { assertValidSlippage, deriveAutoSlippage, fetchOpenEstimatePrice } from "../shared/open-estimate-guard";
import {
  calculateExpectedSettlementLoss,
  calculateSolverFees,
  calculateTradeParams,
  computePlatformFeeLegs,
} from "../shared/trade-math";
import type { InstantOpenMarketData, PositionType } from "../shared/types";

/**
 * Fields shared by every {@link GetInstantOpenFeesParameters} funding mode.
 */
type BaseGetInstantOpenFeesParameters = ReadSolverParameter & {
  /** Sub-account / partyA address the platform fee rates are read for. */
  subAccountAddress: Address;
  /** Market identification + optional pre-fetched precision metadata. */
  market: InstantOpenMarketData;
  /** Trade side. */
  positionType: PositionType;
  /** Position leverage (integer ≥ 1). */
  leverage: number;
  /**
   * Slippage tolerance percent (e.g. `5` for 5%). **Required on majors
   * (non-lowcap) solvers.** On a lowcap solver it may be omitted to
   * auto-derive from the dry-run estimate plus 4% headroom — the same rule
   * as `prepareInstantOpenParams`, so the preview prices what the open will
   * actually charge.
   */
  slippage?: number;
  /** Pre-fetched mark price as decimal string. When omitted, fetched via the price service. */
  markPrice?: string;
  /** Pre-fetched on-chain fee rates (matches `getFeeForUser` return). When omitted, fetched. */
  feeRates?: FeeForUser;
  /**
   * Pre-fetched solver estimated open (fill) price as decimal string —
   * **lowcap/Enigma only**; ignored on any other solver kind. When omitted
   * on a lowcap solver, fetched via `GET /estimated-price`.
   */
  estimatedOpenPrice?: string;
  /**
   * Pre-fetched solver locked params (matches `getLockedParams` return).
   * Only consulted in full-balance mode — the sizing needs the locked-param
   * percents; when omitted there, fetched via `getLockedParams`.
   */
  lockedParamPercent?: ApiLockedParamsBySymbolIdResponse;
  /**
   * Pre-fetched solver static fees (matches `getSolverInfo` return) —
   * **lowcap/Enigma only**; ignored on any other solver kind. When omitted on
   * a lowcap solver, fetched via `getSolverInfo` (fail-soft: an unreachable
   * `/info` prices both static legs at `"0"`).
   */
  solverInfo?: EnigmaSolverInfo;
};

/**
 * Parameters for {@link getInstantOpenFees}. A subset of
 * `PrepareInstantOpenParameters` — the trade intent plus optional pre-fetched
 * data; every pre-filled optional field skips its network fetch.
 *
 * The funding source mirrors `prepareInstantOpenParams`: pass a typed
 * `initialMargin`, **or** `fund` ({@link FullBalanceFunding}, lowcap only) to
 * preview a full-balance open — the preview then runs the same
 * probe-and-rescale sizing as the open, so its legs and `quantity` equal what
 * the open charges. Provide exactly one; passing both, or neither, throws.
 */
export type GetInstantOpenFeesParameters = Compute<
  BaseGetInstantOpenFeesParameters & {
    /** Collateral (USD) the user enters as initial margin. Decimal string. Provide this **or** `fund`. */
    initialMargin?: string;
    /**
     * Preview a full-balance open — lowcap (Enigma) only. Provide this **or**
     * `initialMargin`. See {@link FullBalanceFunding}.
     */
    fund?: FullBalanceFunding;
  }
>;

/**
 * Fee legs every solver kind charges on an instant open.
 */
export interface BaseInstantOpenFees {
  /** Platform open fee: `getFeeForUser.openFee × notional / 1e18` (decimal string). */
  platformOpenFee: string;
  /** Platform close fee, provisioned at open: `getFeeForUser.closeFee × notional / 1e18` (decimal string). */
  platformCloseFee: string;
  /** Leveraged notional the fee rates were applied to (decimal string). */
  notional: string;
  /**
   * Leveraged base-asset quantity the legs were computed on (decimal string) —
   * in full-balance mode this is the rescaled, lot-snapped size the open will
   * actually submit. Feed this to TP/SL and constraint previews instead of
   * re-deriving from the typed margin.
   */
  quantity: string;
  /** Sum of every fee leg on this quote (decimal string). */
  totalFee: string;
}

/**
 * Fee breakdown for a **lowcap (Enigma)** instant open. Extends the platform
 * legs with the solver fees and the settlement provision the solver charges
 * from the VA balance.
 */
export interface EnigmaInstantOpenFees extends BaseInstantOpenFees {
  /** Discriminant: these fees were priced for an Enigma (lowcap) solver. */
  kind: "enigma";
  /** Solver open fee: `hedgerFeeOpen × notional` (decimal string). */
  openSolverFee: string;
  /**
   * Solver close fee provisioned at open (decimal string). Because the holding
   * time is unknown at open and an early close costs more, this is the
   * worst-case `earlyRate × notional` from the market's close-fee schedule
   * (falling back to the flat `hedgerFeeClose × notional` when no schedule is
   * available).
   */
  closeSolverFee: string;
  /**
   * Expected settlement loss vs the dry-run estimate: side-aware
   * `max(0, adverse fill deviation × quantity)` (decimal string). `"0"` when
   * no usable estimate exists.
   */
  expectedSettlementLoss: string;
  /**
   * Static solver fee charged per instant open — a flat USD amount from the
   * solver's `/info` config, independent of the notional (decimal string).
   * `"0"` when the solver publishes none.
   */
  staticSolverFeeOpen: string;
  /**
   * Static solver close fee provisioned at open — a flat USD amount from the
   * solver's `/info` config, independent of the notional (decimal string).
   * `"0"` when the solver publishes none.
   */
  staticSolverFeeClose: string;
}

/**
 * Fee breakdown for a **majors (Rasa)** instant open — platform legs only.
 */
export interface RasaInstantOpenFees extends BaseInstantOpenFees {
  /** Discriminant: these fees were priced for a Rasa (majors) solver. */
  kind: "rasa";
}

/**
 * Return type of {@link getInstantOpenFees}. Narrow on `kind` to reach the
 * lowcap-only legs.
 */
export type GetInstantOpenFeesReturnType = EnigmaInstantOpenFees | RasaInstantOpenFees;

/**
 * Preview every fee a new instant-open quote pays, separated by leg plus the
 * total — without signing or submitting anything.
 *
 * Mirrors the exact resolution and math `prepareInstantOpenParams` uses, so
 * the preview equals what the open charges for the same inputs:
 *
 * - **Both kinds**: `platformOpenFee` + `platformCloseFee`
 *   (on-chain `getFeeForUser` rates × leveraged notional).
 * - **Lowcap (Enigma) only**: `openSolverFee` (`hedgerFeeOpen × notional`) +
 *   `closeSolverFee` (the worst-case close rate × notional — see
 *   {@link EnigmaInstantOpenFees.closeSolverFee}),
 *   `staticSolverFeeOpen` + `staticSolverFeeClose` (flat USD amounts from the
 *   solver's `/info` config, size-independent) and
 *   `expectedSettlementLoss` (dry-run estimate vs mark) — the legs the solver
 *   charges from the VA balance.
 *
 * `totalFee` sums every leg, including the settlement provision — it is the
 * amount the user must fund even though the settlement leg is a provision
 * rather than a fee the solver keeps.
 *
 * With `fund` ({@link FullBalanceFunding}) instead of `initialMargin`, the
 * preview runs the same probe-and-rescale sizing as the open — lot snap, cost
 * invariant, slippage-bound settlement fallback included — so the reported
 * legs and `quantity` are those of the trade the open will actually submit.
 *
 * @throws {SymmError} `SLIPPAGE_REQUIRED` on majors without `slippage`;
 *   `AMBIGUOUS_FUNDING` / `INITIAL_MARGIN_REQUIRED` /
 *   `FULL_BALANCE_UNSUPPORTED` for a broken funding one-of;
 *   `QUOTE_CONSTRAINT_VIOLATED` when the full-balance sizing violates a
 *   published market constraint;
 *   `INVALID_SLIPPAGE` / `INVALID_TRADE_PARAMETERS` /
 *   `RESOLVE_MARKET_NOT_FOUND` / `RESOLVE_MARK_PRICE_NOT_FOUND` for invalid or
 *   unresolvable inputs.
 *
 * @example
 * ```ts
 * const fees = await getInstantOpenFees(config, {
 *   subAccountAddress,
 *   market: { id: 1 },
 *   positionType: PositionType.LONG,
 *   initialMargin: "100",
 *   leverage: 5,
 * });
 * if (fees.kind === "enigma") console.log(fees.openSolverFee, fees.expectedSettlementLoss);
 * console.log(fees.totalFee);
 * ```
 */
export async function getInstantOpenFees(
  config: Config,
  parameters: GetInstantOpenFeesParameters,
): Promise<GetInstantOpenFeesReturnType> {
  if (parameters.slippage !== undefined) assertValidSlippage(parameters.slippage);

  /** Estimate-driven legs exist only on lowcap (Enigma) solvers — a majors preview is platform legs only. */
  const isLowcap = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId }).id === "enigma";
  if (parameters.slippage === undefined && !isLowcap) {
    throw new SymmError(
      "validation",
      "SLIPPAGE_REQUIRED",
      "getInstantOpenFees: slippage is required on this solver — auto-derived slippage is lowcap-only.",
    );
  }

  // Same one-of funding contract as `prepareInstantOpenParams`, so a preview
  // can always be expressed for the exact open it mirrors.
  const isFullBalance = parameters.fund !== undefined;
  if (isFullBalance && parameters.initialMargin !== undefined) {
    throw new SymmError(
      "validation",
      "AMBIGUOUS_FUNDING",
      "getInstantOpenFees: pass exactly one of initialMargin or fund, not both.",
    );
  }
  if (isFullBalance && !isLowcap) {
    throw new SymmError(
      "validation",
      "FULL_BALANCE_UNSUPPORTED",
      "getInstantOpenFees: full-balance funding is lowcap (Enigma) only — pass initialMargin on this solver.",
    );
  }
  if (!isFullBalance && parameters.initialMargin === undefined) {
    throw new SymmError(
      "validation",
      "INITIAL_MARGIN_REQUIRED",
      "getInstantOpenFees: pass initialMargin, or fund: { mode: 'full-balance', balance } on a lowcap solver.",
    );
  }
  const initialMargin = isFullBalance ? parameters.fund!.balance : parameters.initialMargin!;

  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
    hedgerFeeOpen: parameters.market.hedgerFeeOpen,
    hedgerFeeClose: parameters.market.hedgerFeeClose,
    hedgerFeeCloseEarlyRate: parameters.market.hedgerFeeCloseEarlyRate,
    hedgerFeeCloseEarlyThreshold: parameters.market.hedgerFeeCloseEarlyThreshold,
    hedgerFeeCloseStandardThreshold: parameters.market.hedgerFeeCloseStandardThreshold,
    includeHedgerFees: isLowcap,
    /** Full-balance only: the sizing snaps to the lot grid and validates the published floors. */
    includeQuoteConstraints: isFullBalance,
    minAcceptablePortionLf: parameters.market.minAcceptablePortionLf,
    minAcceptableQuoteValue: parameters.market.minAcceptableQuoteValue,
    maxNotionalValue: parameters.market.maxNotionalValue,
    minNotionalValue: parameters.market.minNotionalValue,
    maxQuantity: parameters.market.maxQuantity,
    lotSize: parameters.market.lotSize,
  });
  const [markPrice, feeRates, lockedParams, staticFees] = await Promise.all([
    resolveMarkPrice(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      marketName: market.name,
      markPrice: parameters.markPrice,
    }),
    resolveFeeRates(config, {
      chainId: parameters.chainId,
      subAccountAddress: parameters.subAccountAddress,
      marketId: parameters.market.id,
      feeRates: parameters.feeRates,
    }),
    // Full-balance sizing needs the locked-param percents — the locks dominate
    // the margin the balance must cover. A typed-margin preview does not.
    isFullBalance
      ? resolveLockedParams(config, {
          chainId: parameters.chainId,
          solverId: parameters.solverId,
          marketName: market.name,
          leverage: parameters.leverage,
          lockedParamPercent: parameters.lockedParamPercent,
        })
      : Promise.resolve(undefined),
    // Static solver fees are a lowcap leg — majors previews never fetch them.
    isLowcap
      ? resolveSolverInfo(config, {
          chainId: parameters.chainId,
          solverId: parameters.solverId,
          solverInfo: parameters.solverInfo,
        })
      : Promise.resolve({ staticSolverFeeOpen: "0", staticSolverFeeClose: "0" }),
  ]);

  const calculationInput = {
    markPrice,
    positionType: parameters.positionType,
    userInput: initialMargin,
    inputField: "PRICE" as const,
    leverage: parameters.leverage,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
    ...(lockedParams
      ? {
          cvaPercent: lockedParams.cva,
          lfPercent: lockedParams.lf,
          partyAmmPercent: lockedParams.partyAmm,
          partyBmmPercent: lockedParams.partyBmm,
        }
      : {}),
  };

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

  // Full-balance preview: run the exact sizing the open runs — probe, linear
  // rescale, lot snap, cost invariant — and report the legs of the trade that
  // will actually be submitted.
  if (isFullBalance) {
    const { trade, costs } = sizeFullBalanceInstantOpen({
      balance: initialMargin,
      calculationInput: { ...calculationInput, slippage },
      expectedFillPrice,
      feeRates,
      hedgerFeeOpen: market.hedgerFeeOpen,
      hedgerFeeClose: market.hedgerFeeClose,
      hedgerFeeCloseEarlyRate: market.hedgerFeeCloseEarlyRate,
      hedgerFeeCloseEarlyThreshold: market.hedgerFeeCloseEarlyThreshold,
      hedgerFeeCloseStandardThreshold: market.hedgerFeeCloseStandardThreshold,
      staticSolverFeeOpen: staticFees.staticSolverFeeOpen,
      staticSolverFeeClose: staticFees.staticSolverFeeClose,
      constraints: {
        minAcceptablePortionLf: market.minAcceptablePortionLf,
        minAcceptableQuoteValue: market.minAcceptableQuoteValue,
        maxNotionalValue: market.maxNotionalValue,
        minNotionalValue: market.minNotionalValue,
        maxQuantity: market.maxQuantity,
        lotSize: market.lotSize,
      },
    });
    return {
      kind: "enigma",
      platformOpenFee: costs.platformOpenFee,
      platformCloseFee: costs.platformCloseFee,
      notional: trade.notional,
      quantity: trade.quantity,
      openSolverFee: costs.openSolverFee,
      closeSolverFee: costs.closeSolverFee,
      staticSolverFeeOpen: costs.staticSolverFeeOpen,
      staticSolverFeeClose: costs.staticSolverFeeClose,
      expectedSettlementLoss: costs.expectedSettlementLoss,
      totalFee: toDecimal(costs.platformOpenFee)
        .plus(costs.platformCloseFee)
        .plus(costs.openSolverFee)
        .plus(costs.closeSolverFee)
        .plus(costs.staticSolverFeeOpen)
        .plus(costs.staticSolverFeeClose)
        .plus(costs.expectedSettlementLoss)
        .toString(),
    };
  }

  const { platformOpenFee, platformCloseFee } = computePlatformFeeLegs(
    feeRates,
    tradeCalc.notional,
    tradeCalc.notional,
  );

  if (!isLowcap) {
    return {
      kind: "rasa",
      platformOpenFee,
      platformCloseFee,
      notional: tradeCalc.notional,
      quantity: tradeCalc.quantity,
      totalFee: toDecimal(platformOpenFee).plus(platformCloseFee).toString(),
    };
  }

  const { openSolverFee, closeSolverFee, staticSolverFeeOpen, staticSolverFeeClose } = calculateSolverFees({
    notional: tradeCalc.notional,
    hedgerFeeOpen: market.hedgerFeeOpen,
    hedgerFeeClose: market.hedgerFeeClose,
    hedgerFeeCloseEarlyRate: market.hedgerFeeCloseEarlyRate,
    hedgerFeeCloseEarlyThreshold: market.hedgerFeeCloseEarlyThreshold,
    hedgerFeeCloseStandardThreshold: market.hedgerFeeCloseStandardThreshold,
    staticSolverFeeOpen: staticFees.staticSolverFeeOpen,
    staticSolverFeeClose: staticFees.staticSolverFeeClose,
  });
  const expectedSettlementLoss = calculateExpectedSettlementLoss({
    positionType: parameters.positionType,
    markPrice,
    expectedFillPrice,
    quantity: tradeCalc.quantity,
  });

  return {
    kind: "enigma",
    platformOpenFee,
    platformCloseFee,
    notional: tradeCalc.notional,
    quantity: tradeCalc.quantity,
    openSolverFee,
    closeSolverFee,
    staticSolverFeeOpen,
    staticSolverFeeClose,
    expectedSettlementLoss,
    totalFee: toDecimal(platformOpenFee)
      .plus(platformCloseFee)
      .plus(openSolverFee)
      .plus(closeSolverFee)
      .plus(staticSolverFeeOpen)
      .plus(staticSolverFeeClose)
      .plus(expectedSettlementLoss)
      .toString(),
  };
}
