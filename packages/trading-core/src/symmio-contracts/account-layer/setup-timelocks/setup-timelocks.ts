import type { Hash } from "viem";
import type { Config } from "../../../core/config";
import { getMinTimelockDelay } from "../get-min-timelock-delay";
import { timelockSelectorOf } from "../timelock-selector";
import type { SetupTimelocksParameters } from "../timelock-types";
import { writeTimelock } from "../write-timelock";

/**
 * Configure timelock policy for selectors on a root sub-account.
 *
 * @param config - SDK configuration used for reads and submission.
 * @param parameters - Root account, unlocker, delay, selectors, and write controls.
 * @returns The wallet or relayer transaction hash.
 * @throws {RangeError} When the delay is below the contract or provider minimum.
 */
export async function setupTimelocks(config: Config, parameters: SetupTimelocksParameters): Promise<Hash> {
  const minDelay = await getMinTimelockDelay(config, { chainId: parameters.chainId });
  const requiredDelay =
    parameters.providerMinimumDelay !== undefined && parameters.providerMinimumDelay > minDelay
      ? parameters.providerMinimumDelay
      : minDelay;
  if (parameters.delay < requiredDelay)
    throw new RangeError(`setupTimelocks: delay ${parameters.delay} is below the required minimum ${requiredDelay}.`);
  return writeTimelock(config, parameters, "setupTimelocks", [
    parameters.account,
    parameters.unlocker,
    parameters.delay,
    parameters.selectors.map(timelockSelectorOf),
  ]);
}
