import type { Hex } from "viem";
import type { Config } from "../../../core/config";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Read whether a single-use approval digest has already been consumed.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Approval digest and optional chain.
 * @returns `true` after that approval has been executed.
 */
export async function isTimelockApprovalUsed(
  config: Config,
  parameters: { chainId?: number; approvalHash: Hex },
): Promise<boolean> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "isApprovalUsed",
    args: [parameters.approvalHash],
  });
}
