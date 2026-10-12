import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Parameters for {@link getVirtualAccountsCountOfSubAccount}.
 */
export type GetVirtualAccountsCountOfSubAccountParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose Virtual Accounts (VAs) to count. */
    subAccount: Address;
  }
>;

/** Return type of {@link getVirtualAccountsCountOfSubAccount}: the number of VAs the subaccount holds. */
export type GetVirtualAccountsCountOfSubAccountReturnType = bigint;

/**
 * Read how many Virtual Accounts (VAs) a subaccount holds. Use it to page
 * {@link getVirtualAccountsOfSubAccount} or
 * {@link getVirtualAccountsAddressesOfSubAccount} past their default limit of
 * 200; below that, one list call already returns every VA.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional chain id.
 * @returns The VA count.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const count = await getVirtualAccountsCountOfSubAccount(config, { subAccount: "0xsub…" });
 * ```
 */
export async function getVirtualAccountsCountOfSubAccount(
  config: Config,
  parameters: GetVirtualAccountsCountOfSubAccountParameters,
): Promise<GetVirtualAccountsCountOfSubAccountReturnType> {
  const { chainId, subAccount } = parameters;
  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getVirtualAccountsCountOfSubAccount",
    args: [subAccount],
  });
}
