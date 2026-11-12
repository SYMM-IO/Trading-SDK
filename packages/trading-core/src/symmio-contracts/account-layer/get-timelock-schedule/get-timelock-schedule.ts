import { keccak256 } from "viem";
import type { Config } from "../../../core/config";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { GetTimelockScheduleParameters } from "../timelock-types";
import type { TimelockSchedule } from "../types";

/**
 * Read the schedule for the hash of exact raw operation calldata.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Root account, raw calldata, and optional chain.
 * @returns The schedule timestamp and nonce; zero values mean no active schedule.
 */
export async function getTimelockSchedule(
  config: Config,
  parameters: GetTimelockScheduleParameters,
): Promise<TimelockSchedule> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  const raw = await config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSchedule",
    args: [parameters.account, keccak256(parameters.callData)],
    ...(parameters.blockNumber !== undefined ? { blockNumber: parameters.blockNumber } : {}),
  });
  return { scheduledAt: raw.scheduledAt, nonce: raw.nonce };
}
