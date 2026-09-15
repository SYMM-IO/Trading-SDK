import { encodeFunctionData } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import {
  simulateCallAsSubAccount,
  type SimulateCallAsSubAccountReturnType,
} from "../internal/simulate-call-as-sub-account";
import type { RequestCancelWithdrawParameters } from "./request-cancel-withdraw";

/**
 * Parameters for {@link simulateRequestCancelWithdraw}: the write's parameters
 * plus an optional `from` (the address the dry-run runs as).
 */
export type SimulateRequestCancelWithdrawParameters = Compute<RequestCancelWithdrawParameters & FromParameter>;

/**
 * Return type of {@link simulateRequestCancelWithdraw}: viem's `{ request, result }`
 * for the routed AccountLayer `_call` (see {@link SimulateCallAsSubAccountReturnType}).
 */
export type SimulateRequestCancelWithdrawReturnType = SimulateCallAsSubAccountReturnType;

/**
 * Dry-run {@link requestCancelWithdraw} without sending a transaction. Encodes the
 * same core `requestCancelWithdraw` calldata as the write and dry-runs it through
 * the AccountLayer `_call` proxy via the public client.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, request id, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the routed `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateRequestCancelWithdraw(
  config: Config,
  parameters: SimulateRequestCancelWithdrawParameters,
): Promise<SimulateRequestCancelWithdrawReturnType> {
  const { chainId, account, requestId, from } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "requestCancelWithdraw",
    args: [requestId],
  });

  return simulateCallAsSubAccount(config, { account, data, from, chainId });
}
