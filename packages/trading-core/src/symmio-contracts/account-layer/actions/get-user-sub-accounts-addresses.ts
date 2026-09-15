import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

/**
 * Parameters for {@link getUserSubAccountsAddresses}.
 */
export type GetUserSubAccountsAddressesParameters = Compute<
  ChainIdParameter & {
    /** EOA whose subaccount addresses to list. */
    user: Address;
    /**
     * Pagination offset, in subaccounts.
     * @default 0n
     */
    offset?: bigint;
    /**
     * Pagination limit, in subaccounts. The default matches the value the SYMMIO
     * Explorer Inspector page uses.
     * @default 200n
     */
    limit?: bigint;
  }
>;

/** Return type of {@link getUserSubAccountsAddresses}. */
export type GetUserSubAccountsAddressesReturnType = readonly Address[];

/**
 * Read the addresses of all SYMMIO subaccounts owned by `user`. A lighter
 * alternative to {@link getUserSubAccounts} when only the addresses are needed.
 *
 * Resolves the viem client and `AccountLayer` address from `config` for the
 * given chain (or the config's default chain when `chainId` is omitted).
 *
 * @param config - The SDK config.
 * @param parameters - User address, optional pagination, optional chain id.
 * @returns The user's subaccount addresses.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const addresses = await getUserSubAccountsAddresses(config, { user: "0xabc…", limit: 100n });
 * ```
 */
export async function getUserSubAccountsAddresses(
  config: Config,
  parameters: GetUserSubAccountsAddressesParameters,
): Promise<GetUserSubAccountsAddressesReturnType> {
  const { chainId, user, offset = 0n, limit = 200n } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getUserSubAccountsAddresses",
    args: [user, offset, limit],
  });
}
