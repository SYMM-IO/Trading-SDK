import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import type { InstantLayerAccount } from "../types";

/**
 * Parameters for {@link getActiveDelegations}.
 */
export type GetActiveDelegationsParameters = Compute<
  ChainIdParameter & {
    /** Account whose delegations are inspected. May be a sub-account or a virtual account. */
    delegator: InstantLayerAccount;
    /** Delegated signers to probe. */
    delegates: readonly Address[];
    /**
     * Selectors to probe per delegate: `selectors[i]` is the `bytes4[]` checked
     * for `delegates[i]`, so the two arrays are parallel and must be the same
     * length.
     */
    selectors: readonly (readonly Hex[])[];
  }
>;

/**
 * One delegation the Instant Layer reports as currently active.
 *
 * Mirrors the contract's `InstantLayer.DelegationInfo` struct.
 */
export interface ActiveDelegationInfo {
  /** The canonical account the delegation is enforced under. */
  account: InstantLayerAccount;
  /** Signer holding the delegated authority. */
  delegatedSigner: Address;
  /** Selectors of the probed set that are actually delegated and live. */
  selectors: readonly Hex[];
  /**
   * The **earliest** expiry among {@link ActiveDelegationInfo.selectors}, as a
   * Unix timestamp in seconds — not a single grant-wide expiry.
   *
   * The contract tracks `minExpiry` while collecting the active selectors and
   * returns the soonest (`InstantLayer.getActiveDelegations`). Selectors granted
   * in different transactions therefore expire at different times, and a UI that
   * renders this as "expires at" understates every selector but the
   * shortest-lived one. Read {@link getDelegationExpiry} per selector when the
   * exact per-selector expiry matters.
   */
  expiryTimestamp: bigint;
}

/** Return type of {@link getActiveDelegations}: only the delegations that are live. */
export type GetActiveDelegationsReturnType = readonly ActiveDelegationInfo[];

/**
 * Read which of the probed (delegate, selector) pairs are currently active
 * delegations for one delegator, in a single call.
 *
 * **This is the canonicalizing getter — prefer it.** {@link getIsDelegationActive}
 * and {@link getDelegationExpiry} read the raw `delegations` mapping verbatim:
 * they do **not** canonicalize a virtual account to its parent sub-account,
 * while the Instant Layer's own enforcement path does. So a caller holding a
 * virtual account address gets `false` / `0n` from the raw readers even though
 * the delegate really can act through that VA. `getActiveDelegations` resolves
 * the account the way enforcement does, which makes it the only read that
 * answers "may this key act right now?" correctly for every account shape.
 *
 * **It is also a filter, not a mirror.** The returned entries cover only the
 * probed pairs that are live; a delegate you passed that holds nothing (or
 * whose grant expired) is simply absent from the result rather than present
 * with an empty selector list.
 *
 * **Revocation timing.** A delegation stays in this result for the whole
 * revocation cooldown after `initiateRevokeDelegation` — enforcement only
 * stops at `pendingRevocationEta`, and `finalizeRevokeDelegation` clears the
 * stored grant afterwards. The contract's `DelegationInfo` struct carries no
 * pending-ETA field, so a UI that wants to show "revoking, live until …" must
 * read the InstantLayer's `pendingRevocationEta(delegator, delegate, selector)`
 * mapping alongside this call.
 *
 * @param config - The SDK config.
 * @param parameters - Delegator account, parallel delegate and selector lists, optional chain id.
 * @returns The subset of probed delegations that are active, with their expiry timestamps.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * // Safe for a virtual account address — this read canonicalizes, the raw mapping readers do not.
 * const active = await getActiveDelegations(config, {
 *   delegator: { addr: virtualAccount, isPartyB: false },
 *   delegates: [sessionKeyAddress],
 *   selectors: [sessionKeySelectors],
 * });
 * const stillDelegated = active.length > 0;
 * ```
 */
export async function getActiveDelegations(
  config: Config,
  parameters: GetActiveDelegationsParameters,
): Promise<GetActiveDelegationsReturnType> {
  const { chainId, delegator, delegates, selectors } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "getActiveDelegations",
    args: [delegator, delegates, selectors],
  });
}
