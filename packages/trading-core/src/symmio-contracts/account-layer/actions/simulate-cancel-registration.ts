import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { CancelRegistrationParameters } from "./cancel-registration";

/**
 * Parameters for {@link simulateCancelRegistration}: the write's parameters plus
 * an optional `from` (the address the dry-run runs as).
 */
export type SimulateCancelRegistrationParameters = Compute<CancelRegistrationParameters & FromParameter>;

/**
 * Return type of {@link simulateCancelRegistration}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateCancelRegistrationReturnType = SimulateContractReturnType<
  typeof accountLayerAbi,
  "cancelRegistration"
>;

/**
 * Dry-run {@link cancelRegistration} without sending a transaction. Runs
 * `simulateContract` against the AccountLayer via the public client; a would-be
 * revert (not admin, not pending) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Affiliate address, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` (`result` is `undefined` — the function returns nothing).
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateCancelRegistration(
  config: Config,
  parameters: SimulateCancelRegistrationParameters,
): Promise<SimulateCancelRegistrationReturnType> {
  const { chainId, affiliate, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "cancelRegistration",
    args: [affiliate],
    account: from,
  });
}
