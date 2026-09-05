import { encodeFunctionData } from "viem";
import type { Config } from "../../../core/config";
import { getDeallocateUpnlSig } from "../../../muon/deallocate-upnl-sig/get-deallocate-upnl-sig";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import {
  simulateCallAsSubAccount,
  type SimulateCallAsSubAccountReturnType,
} from "../internal/simulate-call-as-sub-account";
import type { DeallocateAndInitiateWithdrawParameters } from "./deallocate-and-initiate-withdraw";

/**
 * Parameters for {@link simulateDeallocateAndInitiateWithdraw}: the write's
 * parameters plus an optional `from` (the address the dry-run runs as).
 */
export type SimulateDeallocateAndInitiateWithdrawParameters = Compute<
  DeallocateAndInitiateWithdrawParameters & FromParameter
>;

/**
 * Return type of {@link simulateDeallocateAndInitiateWithdraw}: viem's
 * `{ request, result }` for the routed AccountLayer `_call` (see
 * {@link SimulateCallAsSubAccountReturnType}).
 */
export type SimulateDeallocateAndInitiateWithdrawReturnType = SimulateCallAsSubAccountReturnType;

/**
 * Dry-run {@link deallocateAndInitiateWithdraw} without sending a transaction.
 * Encodes the same `deallocate` + `initiateWithdraw` calldatas as the write and
 * dry-runs the batched `AccountLayer._call(account, [deallocateData, withdrawData])`
 * through the public client — a faithful simulation of exactly what would be
 * broadcast. A would-be revert on either leg (the deallocate debounce, an
 * insolvent result, a stale `upnlSig`, ...) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, amount, receiver parts, optional speed-up /
 *   provider data, optional Muon `upnlSig` (fetched automatically via
 *   {@link getDeallocateUpnlSig} when omitted), optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the routed `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateDeallocateAndInitiateWithdraw(
  config: Config,
  parameters: SimulateDeallocateAndInitiateWithdrawParameters,
): Promise<SimulateDeallocateAndInitiateWithdrawReturnType> {
  const { chainId, account, amount, parts, speedUp = false, providerData = "0x", from } = parameters;

  const upnlSig = parameters.upnlSig ?? (await getDeallocateUpnlSig(config, { virtualAccount: account, chainId }));

  const deallocateData = encodeFunctionData({
    abi: symmioAbi,
    functionName: "deallocate",
    args: [amount, upnlSig],
  });

  const withdrawData = encodeFunctionData({
    abi: symmioAbi,
    functionName: "initiateWithdraw",
    args: [parts, speedUp, providerData],
  });

  return simulateCallAsSubAccount(config, { account, data: [deallocateData, withdrawData], from, chainId });
}
