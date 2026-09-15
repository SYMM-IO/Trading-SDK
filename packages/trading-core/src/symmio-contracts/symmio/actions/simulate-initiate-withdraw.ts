import { encodeFunctionData } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import {
  simulateCallAsSubAccount,
  type SimulateCallAsSubAccountReturnType,
} from "../internal/simulate-call-as-sub-account";
import type { InitiateWithdrawParameters } from "./initiate-withdraw";

/**
 * Parameters for {@link simulateInitiateWithdraw}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateInitiateWithdrawParameters = Compute<InitiateWithdrawParameters & FromParameter>;

/**
 * Return type of {@link simulateInitiateWithdraw}: viem's `{ request, result }` for
 * the routed AccountLayer `_call` (see {@link SimulateCallAsSubAccountReturnType}).
 */
export type SimulateInitiateWithdrawReturnType = SimulateCallAsSubAccountReturnType;

/**
 * Dry-run {@link initiateWithdraw} without sending a transaction. Encodes the same
 * core `initiateWithdraw` calldata as the write and dry-runs it through the
 * AccountLayer `_call` proxy via the public client — a faithful simulation of
 * exactly what would be broadcast.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, receiver parts, optional speed-up / provider data, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the routed `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateInitiateWithdraw(
  config: Config,
  parameters: SimulateInitiateWithdrawParameters,
): Promise<SimulateInitiateWithdrawReturnType> {
  const { chainId, account, parts, speedUp = false, providerData = "0x", from } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "initiateWithdraw",
    args: [parts, speedUp, providerData],
  });

  return simulateCallAsSubAccount(config, { account, data, from, chainId });
}
