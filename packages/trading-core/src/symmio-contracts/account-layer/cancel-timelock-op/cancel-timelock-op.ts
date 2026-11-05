import { keccak256, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { CancelTimelockOpParameters } from "../timelock-types";
import { writeTimelock } from "../write-timelock";

/**
 * Cancel a pending fallback schedule before its operation executes.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, exact scheduled calldata, and write controls.
 * @returns The wallet or relayer transaction hash.
 */
export async function cancelTimelockOp(config: Config, parameters: CancelTimelockOpParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "cancelTimelockOp", [parameters.account, keccak256(parameters.callData)]);
}
