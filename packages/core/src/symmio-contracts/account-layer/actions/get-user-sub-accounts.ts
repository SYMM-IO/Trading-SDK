import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { SubAccountDetail } from "../types";

/**
 * Parameters for {@link getUserSubAccounts}.
 */
export type GetUserSubAccountsParameters = Compute<
  ChainIdParameter & {
    /** EOA whose subaccounts to list. */
    user: Address;
    /**
     * Pagination offset, in subaccounts.
     * @default 0n
     */
    offset?: bigint;
    /**
     * Pagination limit, in subaccounts. The default matches the value the SYMM
     * Explorer Inspector page uses.
     * @default 200n
     */
    limit?: bigint;
  }
>;

/** Return type of {@link getUserSubAccounts}. */
export type GetUserSubAccountsReturnType = readonly SubAccountDetail[];

/**
 * Read all SYMMIO subaccounts owned by `user`.
 *
 * Resolves the viem client and `AccountLayer` address from `config` for the
 * given chain (or the config's default chain when `chainId` is omitted).
 *
 * @param config - The SDK config.
 * @param parameters - User address, optional pagination, optional chain id.
 * @returns The user's subaccounts.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const subs = await getUserSubAccounts(config, { user: "0xabc…", limit: 100n });
 * ```
 */
export async function getUserSubAccounts(
  config: Config,
  parameters: GetUserSubAccountsParameters,
): Promise<GetUserSubAccountsReturnType> {
  const { chainId, user, offset = 0n, limit = 200n } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const result = await client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getUserSubAccounts",
    args: [user, offset, limit],
  });

  return result;
}
