import type { Config } from "../../../core/config";
import { instantClose } from "../instant-close/instant-close";
import {
  prepareInstantCloseParams,
  type PrepareInstantCloseParameters,
} from "../prepare-instant-close-params/prepare-instant-close-params";
import type { InstantCloseReturnType } from "../shared/types";

/**
 * Resolve missing inputs via {@link prepareInstantCloseParams} and immediately
 * submit through {@link instantClose}.
 *
 * Friendly default for callers that have the close intent and trust the SDK
 * to fetch the rest. For full control — inspect / mutate resolved params
 * between fetch and submit — call `prepareInstantCloseParams` + `instantClose`
 * separately.
 *
 * @example
 * ```ts
 * await instantCloseAuto(config, {
 *   partyA,
 *   market: { id: 1 },
 *   positionType: PositionType.LONG,
 *   quoteId: 42n,
 *   quantityToClose: "0.5",
 *   slippage: 5, // percent — source from the user; hardcode ≥5% (1% often fails to fill)
 * });
 * ```
 */
export async function instantCloseAuto(
  config: Config,
  parameters: PrepareInstantCloseParameters,
): Promise<InstantCloseReturnType> {
  const resolved = await prepareInstantCloseParams(config, parameters);
  return instantClose(config, resolved);
}
