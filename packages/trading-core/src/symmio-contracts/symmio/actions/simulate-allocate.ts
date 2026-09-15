import { encodeFunctionData } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import {
  simulateCallAsSubAccount,
  type SimulateCallAsSubAccountReturnType,
} from "../internal/simulate-call-as-sub-account";
import type { AllocateParameters } from "./allocate";

/**
 * Parameters for {@link simulateAllocate}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateAllocateParameters = Compute<AllocateParameters & FromParameter>;

/**
 * Return type of {@link simulateAllocate}: viem's `{ request, result }` for the
 * routed AccountLayer `_call` (see {@link SimulateCallAsSubAccountReturnType}).
 */
export type SimulateAllocateReturnType = SimulateCallAsSubAccountReturnType;

/**
 * Dry-run {@link allocate} without sending a transaction. Encodes the same core
 * `allocate` calldata as the write and dry-runs it through the AccountLayer
 * `_call` proxy via the public client.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, amount, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` for the routed `_call`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the routed call would revert.
 */
export async function simulateAllocate(
  config: Config,
  parameters: SimulateAllocateParameters,
): Promise<SimulateAllocateReturnType> {
  const { chainId, account, amount, from } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "allocate",
    args: [amount],
  });

  return simulateCallAsSubAccount(config, { account, data, from, chainId });
}
