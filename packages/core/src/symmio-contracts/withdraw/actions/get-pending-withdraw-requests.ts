import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { WithdrawRequest } from "../types";

/**
 * Parameters for {@link getPendingWithdrawRequests}.
 */
export type GetPendingWithdrawRequestsParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose pending requests to list. */
    user: Address;
    /**
     * First request id to scan (inclusive). Request ids start at 1.
     * @default 1n
     */
    start?: bigint;
    /**
     * Number of request ids to scan from `start`. The returned array contains only
     * the non-terminal requests found in that range, so its length may be smaller.
     * @default 200n
     */
    size?: bigint;
  }
>;

/** Return type of {@link getPendingWithdrawRequests}: the non-terminal requests in range. */
export type GetPendingWithdrawRequestsReturnType = readonly WithdrawRequest[];

/**
 * List a subaccount's non-terminal (active) withdraw requests within a paginated
 * id range.
 *
 * Only requests with status `PENDING`, `PROVIDER_ACCEPTED`, `CANCEL_REQUESTED`, or
 * `SUSPENDED` are returned; `COMPLETED`, `CANCELLED`, and `PROVIDER_REJECTED` are
 * excluded. Call {@link "getLastWithdrawRequestId"} first to size the range.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional pagination (`start`/`size`), optional chain id.
 * @returns The active withdraw requests found in the scanned range.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const pending = await getPendingWithdrawRequests(config, { user: "0xsub…" });
 * ```
 */
export async function getPendingWithdrawRequests(
  config: Config,
  parameters: GetPendingWithdrawRequestsParameters,
): Promise<GetPendingWithdrawRequestsReturnType> {
  const { chainId, user, start = 1n, size = 200n } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getPendingWithdrawRequests",
    args: [user, start, size],
  });
}
