import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import { decimalPriceToWei } from "../../../shared/utils/price";
import type { FeeForUser } from "../../../symmio-contracts/symmio/actions/get-fee-for-user";
import type { ApiLockedParamsBySymbolIdResponse } from "../../types/generated/enigma-solver";
import type { InstantOpenParameters } from "../instant-open/types";
import { calculateMargin, calculateTradeParams, computePlatformFee, toWeiBigInt } from "../shared/trade-math";
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
    /** Slippage tolerance percent (e.g. `5` for 5%). */
    slippage: number;
    /** Pre-fetched mark price as decimal string. When omitted, fetched via Enigma price service. */
    markPrice?: string;
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
 * Steps:
 * 1. Resolve market metadata, mark price, locked params, and fee rates —
 *    concurrent fetches with caller-supplied fields short-circuiting.
 * 2. Run {@link calculateTradeParams} to derive `requestedOpenPrice`,
 *    `quantity`, `cva`, `lf`, `partyAmm`, `partyBmm`, `notional`.
 * 3. Run {@link computePlatformFee} + {@link calculateMargin} to derive the
 *    `addMargin` amount.
 * 4. Convert all final values to 18-decimal-wei `bigint`.
 *
 * @throws {SymmError} `RESOLVE_MARKET_NOT_FOUND` /
 *   `RESOLVE_MARKET_METADATA_INCOMPLETE` /
 *   `RESOLVE_MARK_PRICE_NOT_FOUND` / `INVALID_TRADE_PARAMETERS` /
 *   `INVALID_SOLVER_FEE_CAP` for missing / invalid resolved inputs.
 */
export async function prepareInstantOpenParams(
  config: Config,
  parameters: PrepareInstantOpenParameters,
): Promise<InstantOpenParameters> {
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

  const tradeCalc = calculateTradeParams({
    markPrice,
    slippage: parameters.slippage,
    positionType: parameters.positionType,
    userInput: parameters.initialMargin,
    inputField: "PRICE",
    leverage: parameters.leverage,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
    cvaPercent: lockedParams.cva,
    lfPercent: lockedParams.lf,
    partyAmmPercent: lockedParams.partyAmm,
    partyBmmPercent: lockedParams.partyBmm,
  });
  if (!tradeCalc) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "Invalid trade parameters: markPrice or initialMargin is zero/NaN.",
    );
  }

  const platformFee = computePlatformFee(feeRates, tradeCalc.notional, tradeCalc.notional);
  const marginAmount = calculateMargin({
    positionType: parameters.positionType,
    markPrice,
    quantityBasic: tradeCalc.quantityBasic,
    cva: tradeCalc.cva,
    lf: tradeCalc.lf,
    partyAmm: tradeCalc.partyAmm,
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
