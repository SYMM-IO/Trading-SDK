import type { Config } from "../../core/config";
import { instantClose } from "../instant-close/instant-close/instant-close";
import type { InstantCloseReturnType } from "../instant-close/shared/types";
import { prepareLimitCloseParams, type PrepareLimitCloseParameters } from "./prepare-limit-close-params";

/**
 * Submit a LIMIT close request from a minimal parameter set: resolve missing
 * inputs via {@link prepareLimitCloseParams}, then submit through the shared
 * `instantClose` primitive (which honors `orderType = LIMIT`).
 *
 * Friendly default for callers that have the close intent + resting price and
 * trust the SDK to fetch the rest. For full control, call
 * `prepareLimitCloseParams` + `instantClose` separately.
 *
 * @example
 * ```ts
 * const { success } = await limitCloseAuto(config, {
 *   partyA, from,
 *   market: { id: 1 }, positionType: "LONG",
 *   quoteId: 42n, quantityToClose: "0.1", price: "64000",
 * });
 * ```
 */
export async function limitCloseAuto(
  config: Config,
  parameters: PrepareLimitCloseParameters,
): Promise<InstantCloseReturnType> {
  const resolved = await prepareLimitCloseParams(config, parameters);
  return instantClose(config, resolved);
}
