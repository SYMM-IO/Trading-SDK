import { encodeFunctionData } from "viem";
import type { Config } from "../../../core/config";
import { getDeallocateUpnlSig } from "../../../muon/deallocate-upnl-sig/get-deallocate-upnl-sig";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import {
  simulateCallAsSubAccount,
  type SimulateCallAsSubAccountReturnType,
} from "../internal/simulate-call-as-sub-account";
import type { DeallocateParameters } from "./deallocate";

/**
 * Parameters for {@link simulateDeallocate}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateDeallocateParameters = Compute<DeallocateParameters & FromParameter>;

/**
 * Return type of {@link simulateDeallocate}: viem's `{ request, result }` for the
 * routed AccountLayer `_call` (see {@link SimulateCallAsSubAccountReturnType}).
 */
export type SimulateDeallocateReturnType = SimulateCallAsSubAccountReturnType;

/**
 * Dry-run {@link deallocate} without sending a transaction. Encodes the same core
 * `deallocate` calldata as the write and dry-runs it through the AccountLayer
 * `_call` proxy via the public client. A would-be revert (the deallocate debounce,
 * an insolvent result, or a stale `upnlSig`) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, amount, optional Muon `upnlSig` (fetched
 *   automatically via {@link getDeallocateUpnlSig} when omitted), optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the routed `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateDeallocate(
  config: Config,
  parameters: SimulateDeallocateParameters,
): Promise<SimulateDeallocateReturnType> {
  const { chainId, account, amount, from } = parameters;

  const upnlSig =
    parameters.upnlSig ?? (await getDeallocateUpnlSig(config, { virtualAccount: parameters.account, chainId }));

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "deallocate",
    args: [amount, upnlSig],
  });

  return simulateCallAsSubAccount(config, { account, data, from, chainId });
}
