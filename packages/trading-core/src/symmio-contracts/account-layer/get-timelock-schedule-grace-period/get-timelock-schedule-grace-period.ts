import type { Config } from "../../../core/config";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Read how long a mature schedule remains executable.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Optional chain and block snapshot.
 * @returns The schedule grace period in seconds.
 */
export async function getTimelockScheduleGracePeriod(
  config: Config,
  parameters: { chainId?: number; blockNumber?: bigint } = {},
): Promise<bigint> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "scheduleGracePeriod",
    ...(parameters.blockNumber !== undefined ? { blockNumber: parameters.blockNumber } : {}),
  });
}
