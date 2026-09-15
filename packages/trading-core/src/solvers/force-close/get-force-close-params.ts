import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import type { ForceCloseParams } from "./types";

/**
 * Parameters for {@link getForceCloseParams}.
 */
export type GetForceCloseParametersParameters = Compute<
  ChainIdParameter & {
    /** Market symbol id — `forceCloseGapRatio` is per-symbol. */
    symbolId: bigint;
  }
>;

/** Return type of {@link getForceCloseParams}. */
export type GetForceCloseParametersReturnType = ForceCloseParams;

/**
 * Read the protocol force-close parameters — the cooldowns, price penalty,
 * minimum signature period, and the symbol's gap ratio — in **one multicall**.
 * These drive the eligibility gate ({@link checkForceCloseEligibility}) and the
 * price checks, so they are always read together.
 *
 * @param config - The SDK config.
 * @param parameters - The market `symbolId` (for `forceCloseGapRatio`) and optional chain id.
 * @returns The resolved {@link ForceCloseParams}.
 * @throws {SymmError} when the chain is not supported.
 *
 * @example
 * ```ts
 * const { firstCooldown, secondCooldown, pricePenalty, gapRatio } = await getForceCloseParams(config, {
 *   symbolId: 1n,
 * });
 * ```
 */
export async function getForceCloseParams(
  config: Config,
  parameters: GetForceCloseParametersParameters,
): Promise<GetForceCloseParametersReturnType> {
  const { chainId, symbolId } = parameters;
  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const [cooldowns, pricePenalty, minSigPeriod, gapRatio] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: addresses.symmioAddress, abi: symmioAbi, functionName: "forceCloseCooldowns" },
      { address: addresses.symmioAddress, abi: symmioAbi, functionName: "forceClosePricePenalty" },
      { address: addresses.symmioAddress, abi: symmioAbi, functionName: "forceCloseMinSigPeriod" },
      { address: addresses.symmioAddress, abi: symmioAbi, functionName: "forceCloseGapRatio", args: [symbolId] },
    ] as const,
  });

  const [firstCooldown, secondCooldown] = cooldowns;
  return { firstCooldown, secondCooldown, pricePenalty, minSigPeriod, gapRatio };
}
