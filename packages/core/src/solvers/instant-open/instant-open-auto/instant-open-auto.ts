import type { Config } from "../../../core/config";
import { instantOpen, type InstantOpenReturnType } from "../instant-open/instant-open";
import {
  prepareInstantOpenParams,
  type PrepareInstantOpenParameters,
} from "../prepare-instant-open-params/prepare-instant-open-params";

/**
 * Resolve missing inputs via {@link prepareInstantOpenParams} and immediately
 * submit through {@link instantOpen}.
 *
 * Friendly default for callers that have the trade intent and trust the SDK
 * to fetch the rest. For full control — inspect / mutate resolved params
 * between fetch and submit — call `prepareInstantOpenParams` + `instantOpen`
 * separately.
 *
 * @example
 * ```ts
 * const { tempQuoteId } = await instantOpenAuto(config, {
 *   subAccountAddress, sessionKeyAddress, signTypedData,
 *   marketId: 1, positionType: "LONG",
 *   userInput: "100", leverage: 5, slippage: 1,
 * });
 * ```
 */
export async function instantOpenAuto(
  config: Config,
  parameters: PrepareInstantOpenParameters,
): Promise<InstantOpenReturnType> {
  const resolved = await prepareInstantOpenParams(config, parameters);
  return instantOpen(config, resolved);
}
