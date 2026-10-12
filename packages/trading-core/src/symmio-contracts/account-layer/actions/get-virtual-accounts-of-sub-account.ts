import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import type { VirtualAccountIsolationType } from "../../../solvers/instant-open/shared/types";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { VirtualAccountDetail } from "./get-virtual-account";

/**
 * Parameters for {@link getVirtualAccountsOfSubAccount}.
 */
export type GetVirtualAccountsOfSubAccountParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose Virtual Accounts (VAs) to list. */
    subAccount: Address;
    /**
     * Pagination offset into the subaccount's VA list.
     * @default 0n
     */
    offset?: bigint;
    /**
     * Maximum number of VAs to return from `offset`. Clamped on-chain to the
     * number remaining.
     * @default 200n
     */
    limit?: bigint;
  }
>;

/** Return type of {@link getVirtualAccountsOfSubAccount}: the VA details in range. */
export type GetVirtualAccountsOfSubAccountReturnType = readonly VirtualAccountDetail[];

/**
 * List a subaccount's Virtual Accounts (VAs) **with their details**, within a
 * paginated range — one call, where reading addresses first and then each VA
 * would take one call per VA.
 *
 * Each row carries the VA's market (`symbolId`), parent and isolation type, so
 * a UI can group a subaccount's isolated positions by market and side without a
 * second read.
 *
 * @remarks
 * The AccountLayer clamps gracefully: an `offset` at or beyond the total returns
 * an empty array (it does not revert), and `limit` is clamped to the number
 * remaining. One call with the default `limit` therefore returns every VA of a
 * subaccount that has at most 200; page past that with
 * {@link getVirtualAccountsCountOfSubAccount}.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional pagination (`offset`/`limit`), optional chain id.
 * @returns The subaccount's VAs in the scanned range.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const vas = await getVirtualAccountsOfSubAccount(config, { subAccount: "0xsub…" });
 * const byMarket = Map.groupBy(vas, (va) => va.symbolId);
 * ```
 */
export async function getVirtualAccountsOfSubAccount(
  config: Config,
  parameters: GetVirtualAccountsOfSubAccountParameters,
): Promise<GetVirtualAccountsOfSubAccountReturnType> {
  const { chainId, subAccount, offset = 0n, limit = 200n } = parameters;
  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const raw = await client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getVirtualAccountsOfSubAccount",
    args: [subAccount, offset, limit],
  });

  return raw.map((detail) => ({
    accountAddress: detail.accountAddress,
    parentAccount: detail.parentAccount,
    symbolId: detail.symbolId,
    isExists: detail.isExists,
    metadata: detail.metadata,
    isolationType: detail.isolationType as VirtualAccountIsolationType,
  }));
}
