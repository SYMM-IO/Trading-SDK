import type { Hash } from "viem";
import type { Config } from "../../../core/config";
import { timelockSelectorOf } from "../timelock-selector";
import type { ClearTimelocksParameters } from "../timelock-types";
import { writeTimelock } from "../write-timelock";

/**
 * Remove timelock policy from selectors on a root sub-account.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, selectors, and write controls.
 * @returns The wallet or relayer transaction hash.
 */
export async function clearTimelocks(config: Config, parameters: ClearTimelocksParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "clearTimelocks", [
    parameters.account,
    parameters.selectors.map(timelockSelectorOf),
  ]);
}
