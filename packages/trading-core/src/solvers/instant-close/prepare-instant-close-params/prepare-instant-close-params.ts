import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import { toWeiBigInt } from "../../instant-open/shared/trade-math";
import { resolveMarket, resolveMarkPrice } from "../../shared/resolvers";
import type { InstantCloseParameters } from "../instant-close/instant-close";
import { calculateClosePrice, clampClosePrecision } from "../shared/close-math";
import { type InstantCloseMarketData, type PositionType } from "../shared/types";

/**
 * Parameters for {@link prepareInstantCloseParams} and `instantCloseAuto`.
 *
 * Required = inputs only the caller can know (PartyA, quote id, trade
 * intent). Optional = anything derivable from solver / price-service reads.
 * Pre-fill an optional field to skip its fetch.
 */
export type PrepareInstantCloseParameters = Compute<
  WriteSolverParameter & {
    /** PartyA — the VA address that owns the position. */
    partyA: Address;
    /** Market identification + optional pre-fetched precision metadata. */
    market: InstantCloseMarketData;
    /** Side of the position being closed (LONG = sell, SHORT = buy). */
    positionType: PositionType;
    /** Quote id of the position. */
    quoteId: bigint;
    /** Quantity to close as decimal string (base-token units). */
    quantityToClose: string;
    /** Slippage tolerance percent (e.g. `5` for 5%). */
    slippage: number;
    /** Pre-fetched mark price as decimal string. When omitted, fetched via Enigma price service. */
    markPrice?: string;
    /** Forwarded to {@link InstantCloseParameters}. */
    salt?: Hex;
    /** Forwarded to {@link InstantCloseParameters}. */
    deadline?: bigint;
  }
>;

/**
 * Resolve every input the {@link InstantCloseParameters} primitive needs from
 * a minimal parameter set.
 *
 * Steps:
 * 1. Resolve market metadata + mark price (caller-supplied values
 *    short-circuit the fetches).
 * 2. Compute the slippage-adjusted close price via {@link calculateClosePrice}.
 * 3. Clamp `quantityToClose` to the market's `quantityPrecision`.
 * 4. Convert decimal strings to 18-decimal-wei `bigint`.
 *
 * @throws {SymmError} `INSTANT_CLOSE_INVALID_PARAMETERS` when the mark price
 *   is zero/NaN or `quantityToClose` is non-positive.
 */
export async function prepareInstantCloseParams(
  config: Config,
  parameters: PrepareInstantCloseParameters,
): Promise<InstantCloseParameters> {
  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
  });
  const markPrice = await resolveMarkPrice(config, {
    chainId: parameters.chainId,
    marketName: market.name,
    markPrice: parameters.markPrice,
  });

  const closePrice = calculateClosePrice({
    markPrice,
    slippage: parameters.slippage,
    positionType: parameters.positionType,
    pricePrecision: market.pricePrecision,
  });
  const clampedQuantity = clampClosePrecision({
    quantityToClose: parameters.quantityToClose,
    quantityPrecision: market.quantityPrecision,
  });
  if (closePrice === null || clampedQuantity === null) {
    throw new SymmError(
      "validation",
      "INSTANT_CLOSE_INVALID_PARAMETERS",
      "Invalid instant-close parameters: markPrice or quantityToClose is zero/NaN.",
    );
  }

  return {
    chainId: parameters.chainId,
    from: parameters.from,
    partyA: parameters.partyA,
    order: {
      quoteId: parameters.quoteId,
      closePrice: toWeiBigInt(closePrice),
      quantityToClose: toWeiBigInt(clampedQuantity),
    },
    salt: parameters.salt,
    deadline: parameters.deadline,
  };
}
