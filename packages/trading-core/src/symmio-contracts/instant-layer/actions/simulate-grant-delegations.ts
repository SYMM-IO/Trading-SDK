import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import { assertGrantDelegationsInput, toDelegationInfos } from "../grant-delegations-input";
import type { GrantDelegationsParameters } from "./grant-delegations";

/**
 * Parameters for {@link simulateGrantDelegations}: the write's parameters plus
 * an optional `from` (the address the dry-run runs as).
 */
export type SimulateGrantDelegationsParameters = Compute<GrantDelegationsParameters & FromParameter>;

/**
 * Return type of {@link simulateGrantDelegations}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof instantLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateGrantDelegationsReturnType = SimulateContractReturnType<typeof instantLayerAbi, "grantDelegations">;

/**
 * Dry-run {@link grantDelegations} without sending a transaction. Runs
 * `simulateContract` against the InstantLayer via the public client; a would-be
 * revert (for example the caller does not own the account) throws viem's call
 * error.
 *
 * @param config - The SDK config.
 * @param parameters - The granting account, its delegate entries, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`.
 * @throws {SymmError} `GRANT_DELEGATIONS_EMPTY` or `GRANT_DELEGATIONS_PARTYB_UNSUPPORTED`; `UNSUPPORTED_CHAIN` when the chain is unknown.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateGrantDelegations(
  config: Config,
  parameters: SimulateGrantDelegationsParameters,
): Promise<SimulateGrantDelegationsReturnType> {
  assertGrantDelegationsInput(parameters);

  const { chainId, from } = parameters;
  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "grantDelegations",
    args: [toDelegationInfos(parameters)],
    account: from,
  });
}
