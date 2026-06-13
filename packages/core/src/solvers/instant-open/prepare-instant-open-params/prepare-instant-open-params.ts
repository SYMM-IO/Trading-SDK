import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute, FromParameter } from "../../../shared/types/properties";
import type { FeeForUser } from "../../../symmio-contracts/symmio/actions/get-fee-for-user";
import type { ApiLockedParamsBySymbolIdResponse } from "../../types/generated/enigma-solver";
import type { InstantOpenParameters } from "../instant-open/instant-open";
import { calculateMargin, calculateTradeParams, computePlatformFee, toWeiBigInt } from "../shared/trade-math";
import { type InstantOpenMarketData, type PositionType } from "../shared/types";
import { resolveFeeRates, resolveLockedParams, resolveMarket, resolveMarkPrice } from "./resolvers";

/**
 * Parameters for {@link prepareInstantOpenParams} and `instantOpenAuto`.
 *
 * Required = inputs only the caller can know (wallet, session key, trade
 * intent). Optional = anything derivable from solver / price-service / on-chain
 * reads. Pre-fill an optional field to skip its fetch.
 */
export type PrepareInstantOpenParameters = Compute<
  ChainIdParameter &
  FromParameter & {
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
 * @throws {SymmError} `INSTANT_OPEN_MARKET_NOT_FOUND` /
 *   `INSTANT_OPEN_MARKET_METADATA_INCOMPLETE` /
 *   `INSTANT_OPEN_MARK_PRICE_NOT_FOUND` / `INVALID_TRADE_PARAMETERS` for
 *   missing / invalid resolved inputs.
 */
export async function prepareInstantOpenParams(
  config: Config,
  parameters: PrepareInstantOpenParameters,
): Promise<InstantOpenParameters> {
  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
  });
  const [markPrice, lockedParams, feeRates] = await Promise.all([
    resolveMarkPrice(config, {
      chainId: parameters.chainId,
      marketName: market.name,
      markPrice: parameters.markPrice,
    }),
    resolveLockedParams(config, {
      chainId: parameters.chainId,
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
  console.log("tradeCalc", tradeCalc, markPrice);
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
    uuid: parameters.uuid,
    addMarginSalt: parameters.addMarginSalt,
    sendQuoteSalt: parameters.sendQuoteSalt,
    deadline: parameters.deadline,
  };
}
