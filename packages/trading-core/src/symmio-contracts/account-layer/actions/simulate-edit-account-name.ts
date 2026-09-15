import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { EditAccountNameParameters } from "./edit-account-name";

/**
 * Parameters for {@link simulateEditAccountName}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateEditAccountNameParameters = Compute<EditAccountNameParameters & FromParameter>;

/**
 * Return type of {@link simulateEditAccountName}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateEditAccountNameReturnType = SimulateContractReturnType<typeof accountLayerAbi, "editAccountName">;

/**
 * Dry-run {@link editAccountName} without sending a transaction. Runs
 * `simulateContract` against the AccountLayer via the public client; a would-be
 * revert throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, new name, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` (`result` is `undefined` — the function returns nothing).
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateEditAccountName(
  config: Config,
  parameters: SimulateEditAccountNameParameters,
): Promise<SimulateEditAccountNameReturnType> {
  const { chainId, account, name, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "editAccountName",
    args: [account, name],
    account: from,
  });
}
