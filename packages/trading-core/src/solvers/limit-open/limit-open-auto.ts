import type { Config } from "../../core/config";
import { instantOpen } from "../instant-open/instant-open";
import type { InstantOpenReturnType } from "../instant-open/instant-open/types";
import { prepareLimitOpenParams, type PrepareLimitOpenParameters } from "./prepare-limit-open-params";

/**
 * Place a LIMIT open from a minimal parameter set: resolve missing inputs via
 * {@link prepareLimitOpenParams}, then submit through the shared `instantOpen`
 * primitive (which honors `orderType = LIMIT`).
 *
 * Friendly default for callers that have the trade intent + resting price and
 * trust the SDK to fetch the rest. For full control, call
 * `prepareLimitOpenParams` + `instantOpen` separately.
 *
 * @example
 * ```ts
 * const { tempQuoteId } = await limitOpenAuto(config, {
 *   subAccountAddress, from,
 *   market: { id: 1 }, positionType: "LONG",
 *   initialMargin: "100", leverage: 5, price: "64000",
 * });
 * ```
 */
export async function limitOpenAuto(
  config: Config,
  parameters: PrepareLimitOpenParameters,
): Promise<InstantOpenReturnType> {
  const resolved = await prepareLimitOpenParams(config, parameters);
  return instantOpen(config, resolved);
}
