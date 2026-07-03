import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link requestCancelWithdraw}.
 */
export type RequestCancelWithdrawParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount that owns the request. The call is routed through the
     * AccountLayer `_call` proxy; the connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /** Id of the withdraw request to cancel. */
    requestId: bigint;
  }
>;

/** Return type of {@link requestCancelWithdraw}: the submitted transaction hash. */
export type RequestCancelWithdrawReturnType = Hash;

/**
 * Request cancellation of a pending withdraw request.
 *
 * Encodes the SYMMIO core `requestCancelWithdraw(requestId)` call and routes it
 * through `AccountLayer._call(account, …)` so the core attributes it to the
 * subaccount. For a classic (provider-free) request outside any blackout this
 * cancels immediately and returns the locked balance; for provider-backed
 * requests it may transition to `CANCEL_REQUESTED` pending provider approval.
 *
 * Dry-runs the call with {@link simulateRequestCancelWithdraw} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, request id, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await requestCancelWithdraw(config, { account: "0xsub…", requestId: 1n });
 * ```
 */
export async function requestCancelWithdraw(
  config: Config,
  parameters: RequestCancelWithdrawParameters,
): Promise<RequestCancelWithdrawReturnType> {
  const { chainId, account, requestId } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "requestCancelWithdraw",
    args: [requestId],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
