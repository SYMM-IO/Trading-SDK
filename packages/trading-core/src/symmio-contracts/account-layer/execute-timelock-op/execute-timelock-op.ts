import type { Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ExecuteTimelockOpParameters } from "../timelock-types";
import { writeTimelock } from "../write-timelock";

/**
 * Execute an AccountLayer inner call using signed approvals or a mature schedule.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, exact inner call, approvals, and write controls.
 * @returns The wallet or relayer transaction hash.
 */
export async function executeTimelockOp(config: Config, parameters: ExecuteTimelockOpParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "executeTimelockOp", [
    [...(parameters.approvals ?? [])],
    parameters.innerCallData,
  ]);
}
