import type { Config } from "../../../core/config";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Read AccountLayer's contract-wide minimum timelock delay.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Optional chain override.
 * @returns The minimum delay in seconds.
 */
export async function getMinTimelockDelay(config: Config, parameters: { chainId?: number } = {}): Promise<bigint> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "minTimelockDelay",
  });
}
