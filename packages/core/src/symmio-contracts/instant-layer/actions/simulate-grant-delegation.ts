import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.5/instant-layer";
import type { GrantDelegationParameters } from "./grant-delegation";

/**
 * Parameters for {@link simulateGrantDelegation}: the write's parameters plus an
 * optional `from` (the address the dry-run runs as).
 */
export type SimulateGrantDelegationParameters = Compute<GrantDelegationParameters & FromParameter>;

/**
 * Dry-run {@link grantDelegation} without sending a transaction. Runs
 * `simulateContract` against the InstantLayer via the public client; a would-be
 * revert (e.g. caller does not own the account) throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Delegation account, signer, selectors, expiry, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateGrantDelegation(config: Config, parameters: SimulateGrantDelegationParameters) {
  const { chainId, account, delegatedSigner, selectors, expiryTimestamp, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "grantDelegation",
    args: [{ account, delegatedSigner, selectors, expiryTimestamp }],
    account: from,
  });
}

/** Return type of {@link simulateGrantDelegation}: viem's `{ request, result }`. */
export type SimulateGrantDelegationReturnType = Awaited<ReturnType<typeof simulateGrantDelegation>>;
