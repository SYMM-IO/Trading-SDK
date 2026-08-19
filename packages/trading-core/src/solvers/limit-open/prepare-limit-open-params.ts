import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { Compute } from "../../shared/types/properties";
import { supportsLimitOrder } from "../capabilities";
import type { InstantOpenParameters } from "../instant-open/instant-open/types";
import {
  prepareInstantOpenParams,
  type PrepareInstantOpenParameters,
} from "../instant-open/prepare-instant-open-params/prepare-instant-open-params";
import { getLimitOrderDeadline } from "../instant-open/shared/trade-math";
import { ORDER_TYPE_LIMIT } from "../instant-open/shared/types";

/**
 * Parameters for {@link prepareLimitOpenParams} and `limitOpenAuto`.
 *
 * Identical to the market (instant-open) inputs, except the caller supplies an
 * explicit resting **`price`** instead of a fetched `markPrice` + `slippage`
 * band — a limit order rests at exactly that price.
 */
export type PrepareLimitOpenParameters = Compute<
  Omit<PrepareInstantOpenParameters, "markPrice" | "slippage"> & {
    /** Limit price (decimal string) the order rests at. Set by the user; no slippage is applied. */
    price: string;
  }
>;

/**
 * Resolve every input the {@link InstantOpenParameters} primitive needs for a
 * **LIMIT** open, from a minimal parameter set.
 *
 * Same resolution as {@link prepareInstantOpenParams} (market metadata, locked
 * params, fee rates, quantity + locked-margin math), but the user's `price` is
 * used as the priced level with **zero slippage**, and the result is tagged
 * `orderType = LIMIT` so the hedger writes a pending on-chain quote at that
 * price rather than filling at mark.
 *
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver does not
 *   support limit orders (only majors / rasa do).
 * @throws {SymmError} the same resolution errors as {@link prepareInstantOpenParams}.
 */
export async function prepareLimitOpenParams(
  config: Config,
  parameters: PrepareLimitOpenParameters,
): Promise<InstantOpenParameters> {
  if (!supportsLimitOrder(config, { chainId: parameters.chainId, solverId: parameters.solverId })) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_BY_SOLVER",
      "Limit orders are not supported by the resolved solver. Only majors (rasa) support them.",
    );
  }

  const resolved = await prepareInstantOpenParams(config, {
    ...parameters,
    // The user's limit price stands in for the mark price; a limit rests at an
    // exact level, so there is no slippage band.
    markPrice: parameters.price,
    slippage: 0,
  });

  // A resting limit order gets a wider send-quote deadline than a market fill
  // (15 min default); the caller may still override via `parameters.deadline`.
  return { ...resolved, orderType: ORDER_TYPE_LIMIT, deadline: parameters.deadline ?? getLimitOrderDeadline() };
}
