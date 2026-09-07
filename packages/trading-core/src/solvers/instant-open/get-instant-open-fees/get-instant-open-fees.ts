import { toDecimal } from "@symmio/utils/decimal";
import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import type { FeeForUser } from "../../../symmio-contracts/symmio/actions/get-fee-for-user";
import { resolveFeeRates, resolveMarket, resolveMarkPrice } from "../prepare-instant-open-params/resolvers";
import { assertValidSlippage, deriveAutoSlippage, fetchOpenEstimatePrice } from "../shared/open-estimate-guard";
import {
  calculateExpectedSettlementLoss,
  calculateSolverFees,
  calculateTradeParams,
  computePlatformFeeLegs,
} from "../shared/trade-math";
import type { InstantOpenMarketData, PositionType } from "../shared/types";

/**
 * Parameters for {@link getInstantOpenFees}. A subset of
 * `PrepareInstantOpenParameters` — the trade intent plus optional pre-fetched
 * data; every pre-filled optional field skips its network fetch.
 */
export type GetInstantOpenFeesParameters = Compute<
  ReadSolverParameter & {
    /** Sub-account / partyA address the platform fee rates are read for. */
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
  /** Solver close fee, provisioned at open: `hedgerFeeClose × notional` (decimal string). */
  closeSolverFee: string;
  /**
   * Expected settlement loss vs the dry-run estimate: side-aware
   * `max(0, adverse fill deviation × quantity)` (decimal string). `"0"` when
   * no usable estimate exists.
   */
  expectedSettlementLoss: string;
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
 * - **Lowcap (Enigma) only**: `openSolverFee` + `closeSolverFee`
 *   (`hedgerFeeOpen` / `hedgerFeeClose` × notional) and
 *   `expectedSettlementLoss` (dry-run estimate vs mark) — the legs the solver
 *   charges from the VA balance.
 *
 * `totalFee` sums every leg, including the settlement provision — it is the
 * amount the user must fund even though the settlement leg is a provision
 * rather than a fee the solver keeps.
 *
 * @throws {SymmError} `SLIPPAGE_REQUIRED` on majors without `slippage`;
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

  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
    hedgerFeeOpen: parameters.market.hedgerFeeOpen,
    hedgerFeeClose: parameters.market.hedgerFeeClose,
    includeHedgerFees: isLowcap,
  });
  const [markPrice, feeRates] = await Promise.all([
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
  ]);

  const calculationInput = {
    markPrice,
    positionType: parameters.positionType,
    userInput: parameters.initialMargin,
    inputField: "PRICE" as const,
    leverage: parameters.leverage,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
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
      totalFee: toDecimal(platformOpenFee).plus(platformCloseFee).toString(),
    };
  }

  const { openSolverFee, closeSolverFee } = calculateSolverFees({
    notional: tradeCalc.notional,
    hedgerFeeOpen: market.hedgerFeeOpen,
    hedgerFeeClose: market.hedgerFeeClose,
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
    openSolverFee,
    closeSolverFee,
    expectedSettlementLoss,
    totalFee: toDecimal(platformOpenFee)
      .plus(platformCloseFee)
      .plus(openSolverFee)
      .plus(closeSolverFee)
      .plus(expectedSettlementLoss)
      .toString(),
  };
}
