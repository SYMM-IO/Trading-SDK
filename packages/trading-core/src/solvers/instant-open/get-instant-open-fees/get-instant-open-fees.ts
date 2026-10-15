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
import { assertValidSlippage, deriveAutoSlippage, fetchOpenEstimatePrice } from "../shared/open-estimate-guard";
import { resolveInstantOpenSizing, validateInstantOpenBalanceFunding } from "../shared/resolve-instant-open-sizing";
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
  /**
   * Whether `totalFee` includes the `expectedSettlementLoss` provision.
   * Defaults to `true` — the provision is part of what the open funds, even
   * though it is a provision rather than a fee the solver keeps. Pass `false`
   * to report fee legs only; the provision stays available as its own field.
   */
  includeSettlementInTotalFee?: boolean;
  /** Pre-fetched mark price as decimal string. When omitted, fetched via the price service. */
  markPrice?: string;
  /** Pre-fetched on-chain fee rates (matches `getFeeForUser` return). When omitted, fetched. */
  feeRates?: FeeForUser;
  /**
   * Pre-fetched solver estimated open (fill) price as decimal string —
   * **lowcap/Enigma only**; ignored on any other solver kind. When omitted
   * on a lowcap solver, fetched via `GET /estimated-price`. Pass `null` when
   * an estimate was attempted but unavailable to skip fetching and use the fallback.
   */
  estimatedOpenPrice?: string | null;
  /**
   * Pre-fetched solver locked params (matches `getLockedParams` return).
   * Consulted for explicit or automatic full-balance sizing, which needs the
   * locked-param percents; when omitted there, fetched via `getLockedParams`.
   */
  lockedParamPercent?: ApiLockedParamsBySymbolIdResponse;
  /**
   * Pre-fetched solver static fees (matches `getSolverInfo` return) —
   * **lowcap/Enigma only**; ignored on any other solver kind. When omitted on
   * a lowcap solver, fetched via `getSolverInfo` (fail-soft: an unreachable
   * `/info` prices the static open leg at `"0"`).
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
 * With `initialMargin`, `availableBalance` opts into automatic full-balance sizing
 * only when the typed position's required funding exceeds the raw balance.
 * The typed initialMargin itself must not exceed availableBalance.
 */
export type GetInstantOpenFeesParameters = Compute<
  BaseGetInstantOpenFeesParameters & {
    /** Collateral (USD) the user enters as initial margin. Decimal string. Provide this **or** `fund`. */
    initialMargin?: string;
    /**
     * Raw available collateral (USD decimal string). With initialMargin, previews the
     * same automatic full-balance fallback as prepareInstantOpenParams. Lowcap only;
     * must be positive and finite. initialMargin above this balance throws. Cannot accompany fund.
     */
    availableBalance?: string;
    /**
     * Preview a full-balance open — lowcap (Enigma) only. Provide this **or**
     * `initialMargin`. See {@link FullBalanceFunding}.
     */
    fund?: FullBalanceFunding;
  }
>;

/**
 * Fee legs every solver kind charges **at open**. Close fees are charged at
 * close from the position — preview them in the close flow with
 * `getInstantCloseFees`, where the notional and holding time are real.
 */
export interface BaseInstantOpenFees {
  /** Effective sizing mode, including automatic fallback from a typed initial margin. */
  fundingMode: "initial-margin" | "full-balance";
  /** Platform open fee: `getFeeForUser.openFee × notional / 1e18` (decimal string). */
  platformOpenFee: string;
  /** Leveraged notional the fee rates were applied to (decimal string). */
  notional: string;
  /**
   * Leveraged base-asset quantity the legs were computed on (decimal string) —
   * in full-balance mode this is the rescaled, lot-snapped size the open will
   * actually submit. Feed this to TP/SL and constraint previews instead of
   * re-deriving from the typed margin.
   */
  quantity: string;
  /**
   * Sum of every leg the open charges now (decimal string). Includes the
   * settlement provision by default; pass `includeSettlementInTotalFee: false`
   * to sum the fee legs only.
   */
  totalFee: string;
}

/**
 * Fee breakdown for a **lowcap (Enigma)** instant open. Extends the platform
 * leg with the solver open legs and the settlement provision the solver
 * charges from the VA balance.
 */
export interface EnigmaInstantOpenFees extends BaseInstantOpenFees {
  /** Discriminant: these fees were priced for an Enigma (lowcap) solver. */
  kind: "enigma";
  /** Solver open fee: `hedgerFeeOpen × notional` (decimal string). */
  openSolverFee: string;
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
}

/**
 * Fee breakdown for a **majors (Rasa)** instant open — the platform open leg
 * only.
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
 * Preview every fee a new instant-open quote pays **at open**, separated by leg
 * plus the total — without signing or submitting anything.
 *
 * Mirrors the exact resolution and math `prepareInstantOpenParams` uses, so
 * the preview equals what the open charges for the same inputs:
 *
 * - **Both kinds**: `platformOpenFee` (on-chain `getFeeForUser.openFee` ×
 *   leveraged notional).
 * - **Lowcap (Enigma) only**: `openSolverFee` (`hedgerFeeOpen × notional`),
 *   `staticSolverFeeOpen` (flat USD from the solver's `/info` config,
 *   size-independent) and `expectedSettlementLoss` (dry-run estimate vs mark)
 *   — the legs the solver charges from the VA balance.
 *
 * Close fees (platform close, solver close, static close) are **not** part of
 * this preview: they are charged at close from the position, priced by
 * `getInstantCloseFees` in the close flow from the then-current notional and
 * the position's real holding time.
 *
 * `totalFee` sums every open leg. It includes the settlement provision by
 * default — the amount the user must fund even though the settlement leg is a
 * provision rather than a fee the solver keeps; pass
 * `includeSettlementInTotalFee: false` to sum the fee legs only.
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

  /** Estimate-driven legs exist only on lowcap (Enigma) solvers — a majors preview is the platform leg only. */
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
  validateInstantOpenBalanceFunding({ ...parameters, isLowcap });
  const canSizeFullBalance = isFullBalance || parameters.availableBalance !== undefined;
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
  const includeSettlementInTotalFee = parameters.includeSettlementInTotalFee ?? true;

  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
    // The close-side prefills only serve the resolver's short-circuit (skip the
    // markets fetch when the caller pre-fetched the row) — the open cost model
    // uses `hedgerFeeOpen` alone; close fees are priced by `getInstantCloseFees`.
    hedgerFeeOpen: parameters.market.hedgerFeeOpen,
    hedgerFeeClose: parameters.market.hedgerFeeClose,
    hedgerFeeCloseEarlyRate: parameters.market.hedgerFeeCloseEarlyRate,
    hedgerFeeCloseEarlyThreshold: parameters.market.hedgerFeeCloseEarlyThreshold,
    hedgerFeeCloseStandardThreshold: parameters.market.hedgerFeeCloseStandardThreshold,
    includeHedgerFees: isLowcap,
    /** Explicit or automatic full-balance sizing needs the lot grid and published floors. */
    includeQuoteConstraints: canSizeFullBalance,
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
    // the margin the balance must cover, including the automatic fallback check.
    canSizeFullBalance
      ? resolveLockedParams(config, {
          chainId: parameters.chainId,
          solverId: parameters.solverId,
          marketName: market.name,
          leverage: parameters.leverage,
          lockedParamPercent: parameters.lockedParamPercent,
        })
      : Promise.resolve(undefined),
    // The static open fee is a lowcap leg — majors previews never fetch it.
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
  let expectedFillPrice = isLowcap ? (parameters.estimatedOpenPrice ?? undefined) : undefined;
  let needsEstimate = isLowcap && parameters.estimatedOpenPrice === undefined;
  if (slippage === undefined) {
    const sized = calculateTradeParams({ ...calculationInput, slippage: 0 });
    if (!sized) {
      throw new SymmError(
        "validation",
        "INVALID_TRADE_PARAMETERS",
        "Invalid trade parameters: markPrice or initialMargin is zero/NaN.",
      );
    }
    if (needsEstimate) {
      needsEstimate = false;
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

  if (needsEstimate) {
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
  if (canSizeFullBalance) {
    const { trade, costs, fundingMode } = resolveInstantOpenSizing({
      trade: tradeCalc,
      isLowcap,
      fund: parameters.fund,
      availableBalance: parameters.availableBalance,
      calculationInput: { ...calculationInput, slippage },
      // Preserve the legacy zero sentinel for callers; prefer null for unavailable estimates.
      // Full-balance sizing provisions settlement at the price bound when no estimate exists.
      expectedFillPrice: expectedFillPrice === "0" ? undefined : expectedFillPrice,
      feeRates,
      hedgerFeeOpen: market.hedgerFeeOpen,
      staticSolverFeeOpen: staticFees.staticSolverFeeOpen,
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
      fundingMode,
      kind: "enigma",
      platformOpenFee: costs.platformOpenFee,
      notional: trade.notional,
      quantity: trade.quantity,
      openSolverFee: costs.openSolverFee,
      staticSolverFeeOpen: costs.staticSolverFeeOpen,
      expectedSettlementLoss: costs.expectedSettlementLoss,
      totalFee: toDecimal(costs.platformOpenFee)
        .plus(costs.openSolverFee)
        .plus(costs.staticSolverFeeOpen)
        .plus(includeSettlementInTotalFee ? costs.expectedSettlementLoss : "0")
        .toString(),
    };
  }

  const { platformOpenFee } = computePlatformFeeLegs(feeRates, tradeCalc.notional, tradeCalc.notional);

  if (!isLowcap) {
    return {
      fundingMode: "initial-margin",
      kind: "rasa",
      platformOpenFee,
      notional: tradeCalc.notional,
      quantity: tradeCalc.quantity,
      totalFee: platformOpenFee,
    };
  }

  const { openSolverFee, staticSolverFeeOpen } = calculateSolverFees({
    notional: tradeCalc.notional,
    hedgerFeeOpen: market.hedgerFeeOpen,
    hedgerFeeClose: undefined,
    staticSolverFeeOpen: staticFees.staticSolverFeeOpen,
  });
  const expectedSettlementLoss = calculateExpectedSettlementLoss({
    positionType: parameters.positionType,
    markPrice,
    expectedFillPrice,
    quantity: tradeCalc.quantity,
  });

  return {
    fundingMode: "initial-margin",
    kind: "enigma",
    platformOpenFee,
    notional: tradeCalc.notional,
    quantity: tradeCalc.quantity,
    openSolverFee,
    staticSolverFeeOpen,
    expectedSettlementLoss,
    totalFee: toDecimal(platformOpenFee)
      .plus(openSolverFee)
      .plus(staticSolverFeeOpen)
      .plus(includeSettlementInTotalFee ? expectedSettlementLoss : "0")
      .toString(),
  };
}
