import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/**
 * Parameters for {@link getLastWithdrawRequestId}.
 */
export type GetLastWithdrawRequestIdParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose latest request id to read. */
    user: Address;
  }
>;

/**
 * Return type of {@link getLastWithdrawRequestId}: the highest request id (or `0n`
 * when the subaccount has no requests).
 */
export type GetLastWithdrawRequestIdReturnType = bigint;

/**
 * Read the most recent withdraw request id for a subaccount.
 *
 * Request ids are sequential per user starting at 1; this returns the upper bound
 * of the id range (0 when there are none). Use it to paginate
 * {@link "getPendingWithdrawRequests"} or fetch individual requests with
 * {@link "getWithdrawRequests"}.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional chain id.
 * @returns The last assigned request id, or `0n`.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const lastId = await getLastWithdrawRequestId(config, { user: "0xsub…" });
 * ```
 */
export async function getLastWithdrawRequestId(
  config: Config,
  parameters: GetLastWithdrawRequestIdParameters,
): Promise<GetLastWithdrawRequestIdReturnType> {
  const { chainId, user } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getLastWithdrawRequestId",
    args: [user],
  });
}
