import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { WithdrawRequest } from "../types";

/**
 * Parameters for {@link getWithdrawRequests}.
 */
export type GetWithdrawRequestsParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose request to read. */
    user: Address;
    /** Id of the withdraw request (1-based, sequential per user). */
    requestId: bigint;
  }
>;

/** Return type of {@link getWithdrawRequests}: a single withdraw request. */
export type GetWithdrawRequestsReturnType = WithdrawRequest;

/**
 * Read a single withdraw request by `user` and `requestId`.
 *
 * Mirrors the SYMMIO core view function name exactly (it returns one request
 * despite the plural). Use {@link "getLastWithdrawRequestId"} to discover the id
 * range and {@link "getPendingWithdrawRequests"} to list active ones.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, request id, optional chain id.
 * @returns The withdraw request, including its {@link WithdrawStatus} and `cooldownEndTime`.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const request = await getWithdrawRequests(config, { user: "0xsub…", requestId: 1n });
 * ```
 */
export async function getWithdrawRequests(
  config: Config,
  parameters: GetWithdrawRequestsParameters,
): Promise<GetWithdrawRequestsReturnType> {
  const { chainId, user, requestId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getWithdrawRequests",
    args: [user, requestId],
  });
}
