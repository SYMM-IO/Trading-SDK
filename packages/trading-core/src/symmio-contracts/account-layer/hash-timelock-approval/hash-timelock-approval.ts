import type { Hex } from "viem";
import type { Config } from "../../../core/config";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { TimelockApproval } from "../types";

/**
 * Return the contract's canonical EIP-712 digest for an approval tuple.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Approval tuple and optional chain.
 * @returns The approval digest used by events and replay protection.
 */
export async function hashTimelockApproval(
  config: Config,
  parameters: { chainId?: number; approval: TimelockApproval },
): Promise<Hex> {
  assertTimelockSupported(config, parameters.chainId);
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "hashTimelockApproval",
    args: [parameters.approval],
  });
}
