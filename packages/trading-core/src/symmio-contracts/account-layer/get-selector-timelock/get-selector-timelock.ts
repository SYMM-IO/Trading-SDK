import type { Config } from "../../../core/config";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { timelockSelectorOf } from "../timelock-selector";
import type { GetSelectorTimelockParameters } from "../timelock-types";
import type { SelectorTimelock } from "../types";

/**
 * Read the unlocker and delay configured for one root-account selector.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Root account, selector or calldata, and optional chain.
 * @returns The configured unlocker and delay; zero values mean no policy.
 */
export async function getSelectorTimelock(
  config: Config,
  parameters: GetSelectorTimelockParameters,
): Promise<SelectorTimelock> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  const raw = await config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSelectorTimelock",
    args: [parameters.account, timelockSelectorOf(parameters.selector)],
    ...(parameters.blockNumber !== undefined ? { blockNumber: parameters.blockNumber } : {}),
  });
  return { unlocker: raw.unlocker, delay: raw.delay };
}
