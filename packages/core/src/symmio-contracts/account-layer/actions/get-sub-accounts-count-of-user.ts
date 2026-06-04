import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link getSubAccountsCountOfUser}.
 */
export type GetSubAccountsCountOfUserParameters = Compute<
  ChainIdParameter & {
    /** EOA whose subaccount count to read. */
    user: Address;
  }
>;

/** Return type of {@link getSubAccountsCountOfUser}: the number of subaccounts the user owns. */
export type GetSubAccountsCountOfUserReturnType = bigint;

/**
 * Read how many SYMMIO subaccounts `user` owns. Useful for paginating
 * {@link getUserSubAccounts} / {@link getUserSubAccountsAddresses}.
 *
 * Resolves the viem client and `AccountLayer` address from `config` for the
 * given chain (or the config's default chain when `chainId` is omitted).
 *
 * @param config - The SDK config.
 * @param parameters - User address, optional chain id.
 * @returns The subaccount count.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const count = await getSubAccountsCountOfUser(config, { user: "0xabc…" });
 * ```
 */
export async function getSubAccountsCountOfUser(
  config: Config,
  parameters: GetSubAccountsCountOfUserParameters,
): Promise<GetSubAccountsCountOfUserReturnType> {
  const { chainId, user } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSubAccountsCountOfUser",
    args: [user],
  });
}
