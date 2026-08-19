import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { Compute } from "../../shared/types/properties";
import { supportsLimitOrder } from "../capabilities";
import type { InstantCloseParameters } from "../instant-close/instant-close/instant-close";
import {
  prepareInstantCloseParams,
  type PrepareInstantCloseParameters,
} from "../instant-close/prepare-instant-close-params/prepare-instant-close-params";
import { ORDER_TYPE_LIMIT } from "../instant-close/shared/types";
import { getLimitOrderDeadline } from "../instant-open/shared/trade-math";

/**
 * Parameters for {@link prepareLimitCloseParams} and `limitCloseAuto`.
 *
 * Identical to the market (instant-close) inputs, except the caller supplies an
 * explicit resting **`price`** instead of a fetched `markPrice` + `slippage`
 * band — a limit close rests at exactly that price.
 */
export type PrepareLimitCloseParameters = Compute<
  Omit<PrepareInstantCloseParameters, "markPrice" | "slippage"> & {
    /** Close limit price (decimal string) the order rests at. Set by the user; no slippage is applied. */
    price: string;
  }
>;

/**
 * Resolve every input the {@link InstantCloseParameters} primitive needs for a
 * **LIMIT** close, from a minimal parameter set.
 *
 * Same resolution as {@link prepareInstantCloseParams} (market metadata,
 * quantity clamp), but the user's `price` is used as the close level with
 * **zero slippage**, and the result is tagged `orderType = LIMIT` so the hedger
 * writes a pending close resting at that price rather than filling at mark.
 *
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver does not
 *   support limit orders (only majors / rasa do).
 * @throws {SymmError} the same resolution errors as {@link prepareInstantCloseParams}.
 */
export async function prepareLimitCloseParams(
  config: Config,
  parameters: PrepareLimitCloseParameters,
): Promise<InstantCloseParameters> {
  if (!supportsLimitOrder(config, { chainId: parameters.chainId, solverId: parameters.solverId })) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_BY_SOLVER",
      "Limit orders are not supported by the resolved solver. Only majors (rasa) support them.",
    );
  }

  const resolved = await prepareInstantCloseParams(config, {
    ...parameters,
    // The user's limit price stands in for the mark price; a limit close rests
    // at an exact level, so there is no slippage band.
    markPrice: parameters.price,
    slippage: 0,
  });

  // A resting limit close gets the wider limit deadline (15 min default); the
  // caller may still override via `parameters.deadline`.
  return { ...resolved, orderType: ORDER_TYPE_LIMIT, deadline: parameters.deadline ?? getLimitOrderDeadline() };
}
