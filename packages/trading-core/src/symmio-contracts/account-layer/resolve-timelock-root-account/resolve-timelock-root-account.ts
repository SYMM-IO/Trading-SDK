import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { resolveTimelockFamilyAccount } from "../../../timelock/root-account";
import { getVirtualAccount } from "../actions/get-virtual-account";

/**
 * Resolve a live or deleted Virtual Account to its retained timelock family root.
 *
 * @param config - SDK configuration used for the AccountLayer read.
 * @param parameters - Account address and optional chain override.
 * @returns The retained VA parent when present; otherwise `account` unchanged.
 *
 * @example
 * ```ts
 * const root = await resolveTimelockRootAccount(config, { account: virtualAccount });
 * ```
 */
export async function resolveTimelockRootAccount(
  config: Config,
  parameters: { chainId?: number; account: Address },
): Promise<Address> {
  return resolveTimelockFamilyAccount(parameters.account, await getVirtualAccount(config, parameters));
}
