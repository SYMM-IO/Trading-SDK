import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { FinalizeWithdrawRequestParameters } from "./finalize-withdraw-request";

/**
 * Parameters for {@link simulateFinalizeWithdrawRequest}: the write's parameters
 * plus an optional `from` (the address the dry-run runs as).
 */
export type SimulateFinalizeWithdrawRequestParameters = Compute<FinalizeWithdrawRequestParameters & FromParameter>;

/**
 * Dry-run {@link finalizeWithdrawRequest} without sending a transaction. Calls
 * `simulateContract` directly against the SYMMIO core via the public client; a
 * would-be revert (e.g. cooldown not elapsed) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Request owner subaccount, request id, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateFinalizeWithdrawRequest(
  config: Config,
  parameters: SimulateFinalizeWithdrawRequestParameters,
) {
  const { chainId, user, requestId, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "finalizeWithdrawRequest",
    args: [user, requestId],
    account: from,
  });
}

/** Return type of {@link simulateFinalizeWithdrawRequest}: viem's `{ request, result }`. */
export type SimulateFinalizeWithdrawRequestReturnType = Awaited<ReturnType<typeof simulateFinalizeWithdrawRequest>>;
