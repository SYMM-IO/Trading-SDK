import { keccak256, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ScheduleTimelockOpParameters } from "../timelock-types";
import { writeTimelock } from "../write-timelock";

/**
 * Schedule exact raw operation calldata for delayed execution without an approval.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, exact raw calldata, and write controls.
 * @returns The wallet or relayer transaction hash.
 */
export async function scheduleTimelockOp(config: Config, parameters: ScheduleTimelockOpParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "scheduleTimelockOp", [parameters.account, keccak256(parameters.callData)]);
}
