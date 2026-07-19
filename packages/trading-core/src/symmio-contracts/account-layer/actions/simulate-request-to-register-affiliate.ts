import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { RequestToRegisterAffiliateParameters } from "./request-to-register-affiliate";

/**
 * Parameters for {@link simulateRequestToRegisterAffiliate}: the write's
 * parameters plus an optional `from` (the address the dry-run runs as).
 */
export type SimulateRequestToRegisterAffiliateParameters = Compute<
  RequestToRegisterAffiliateParameters & FromParameter
>;

/**
 * Return type of {@link simulateRequestToRegisterAffiliate}: viem's
 * `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateRequestToRegisterAffiliateReturnType = SimulateContractReturnType<
  typeof accountLayerAbi,
  "requestToRegisterAffiliate"
>;

/**
 * Dry-run {@link requestToRegisterAffiliate} without sending a transaction. Runs
 * `simulateContract` against the AccountLayer via the public client; a would-be
 * revert (bad fee-share sum, zero admin, unwhitelisted core, name taken) throws
 * viem's call error. On success, `result` is the deterministic affiliate address.
 *
 * @param config - The SDK config.
 * @param parameters - The registration tuple, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` (`result` is the would-be affiliate address).
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateRequestToRegisterAffiliate(
  config: Config,
  parameters: SimulateRequestToRegisterAffiliateParameters,
): Promise<SimulateRequestToRegisterAffiliateReturnType> {
  const { chainId, registration, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "requestToRegisterAffiliate",
    args: [registration],
    account: from,
  });
}
