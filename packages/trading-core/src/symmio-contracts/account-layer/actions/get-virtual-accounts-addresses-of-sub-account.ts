import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link getVirtualAccountsAddressesOfSubAccount}.
 */
export type GetVirtualAccountsAddressesOfSubAccountParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose Virtual Account (VA) addresses to list. */
    subAccount: Address;
    /**
     * Pagination offset into the subaccount's VA list.
     * @default 0n
     */
    offset?: bigint;
    /**
     * Maximum number of VA addresses to return from `offset`. Clamped on-chain to
     * the number remaining.
     * @default 200n
     */
    limit?: bigint;
  }
>;

/** Return type of {@link getVirtualAccountsAddressesOfSubAccount}: the VA addresses in range. */
export type GetVirtualAccountsAddressesOfSubAccountReturnType = readonly Address[];

/**
 * List the Virtual Account (VA) addresses owned by a subaccount, within a
 * paginated range.
 *
 * In lowcap trading each isolated position lives under a distinct VA, and the VA
 * — not the subaccount — is the on-chain `partyA` for quote reads. Use this to
 * enumerate the VAs to pass to {@link "getPartyAOpenPositions"} /
 * {@link "getPartyAPendingQuotes"}.
 *
 * @remarks
 * Unlike the SYMMIO core paginators, the AccountLayer clamps gracefully: an
 * `offset` at or beyond the total returns an empty array (it does not revert),
 * and `limit` is clamped to the number remaining. The list is backed by an
 * `EnumerableSet`, so ordering is insertion order only until a removal occurs.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional pagination (`offset`/`limit`), optional chain id.
 * @returns The subaccount's VA addresses found in the scanned range.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const vas = await getVirtualAccountsAddressesOfSubAccount(config, { subAccount: "0xsub…" });
 * ```
 */
export async function getVirtualAccountsAddressesOfSubAccount(
  config: Config,
  parameters: GetVirtualAccountsAddressesOfSubAccountParameters,
): Promise<GetVirtualAccountsAddressesOfSubAccountReturnType> {
  const { chainId, subAccount, offset = 0n, limit = 200n } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getVirtualAccountsAddressesOfSubAccount",
    args: [subAccount, offset, limit],
  });
}
