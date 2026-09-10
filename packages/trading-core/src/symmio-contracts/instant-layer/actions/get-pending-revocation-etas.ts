import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import type { InstantLayerAccount } from "../types";

/** Default number of `pendingRevocationEta` reads per multicall batch. */
const DEFAULT_BATCH_SIZE = 10;

/**
 * Parameters for {@link getPendingRevocationEtas}.
 */
export type GetPendingRevocationEtasParameters = Compute<
  ChainIdParameter & {
    /**
     * Account the delegation is enforced under — pass exactly the account that
     * was handed to {@link initiateRevokeDelegation}.
     */
    delegator: InstantLayerAccount;
    /** The delegated signer whose pending revocations are read. */
    delegate: Address;
    /**
     * Selectors to probe — the **granted** set, not `getActiveDelegations`'
     * matched selectors. Enforcement stops at the ETA while the schedule
     * survives until someone finalizes, so the matched set empties out exactly
     * when the revocation becomes finalizable.
     */
    selectors: readonly Hex[];
    /** How many `pendingRevocationEta` reads to bundle per multicall. @default 10 */
    batchSize?: number;
  }
>;

/**
 * Return type of {@link getPendingRevocationEtas}: scheduled revocations keyed
 * by selector, as Unix timestamps in seconds.
 *
 * A probed selector with no scheduled revocation is **absent** from the map
 * rather than present with `0n`, so `map.size === 0` means "nothing is being
 * revoked". Keys are the selectors exactly as they were passed in, so a caller
 * can look one up with its own array element.
 */
export type GetPendingRevocationEtasReturnType = ReadonlyMap<Hex, bigint>;

/**
 * Read the Instant Layer's scheduled revocation ETA for each of a delegate's
 * selectors — the only on-chain signal that a revocation is in flight.
 *
 * **Nothing else reveals a pending revocation.** {@link initiateRevokeDelegation}
 * does not touch the `delegations` mapping; it only stamps
 * `pendingRevocationEta = block.timestamp + revocationCooldown`. The contract
 * keeps enforcing the delegation until that ETA passes, so
 * {@link getIsDelegationActive} and {@link getActiveDelegations} both keep
 * answering "active" for the whole cooldown — correctly, because the key really
 * can still sign. A UI that wants to show "revoking, live until …" must read
 * this mapping alongside them.
 *
 * **The ETA is per selector, not per grant.** A partial revoke schedules only
 * the selectors it was given, so the result can cover a subset of `selectors`.
 * The reads are bundled into **multicalls of `batchSize`** (default 10) to keep
 * each RPC round-trip small.
 *
 * **This read does not canonicalize.** It keys the mapping on `delegator.addr`
 * verbatim, which is exactly what `initiateRevokeDelegation` and
 * `isDelegationActive` do — so pass the same account you revoked with. That is
 * unlike {@link getActiveDelegations}, which resolves a virtual account to its
 * parent sub-account: a VA address answers here only if the revocation was
 * scheduled against that VA.
 *
 * @param config - The SDK config.
 * @param parameters - Delegator account, delegate, selectors, optional chain id and batch size.
 * @returns The scheduled ETAs, keyed by selector; empty when nothing is being revoked.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's `ContractFunctionExecutionError` / multicall errors for on-chain failures.
 *
 * @example
 * ```ts
 * const etas = await getPendingRevocationEtas(config, {
 *   delegator: { addr: subAccount, isPartyB: false },
 *   delegate: sessionKeyAddress,
 *   selectors,
 * });
 * const now = BigInt(Math.floor(Date.now() / 1000));
 * const isRevoking = [...etas.values()].some((eta) => eta > now);
 * ```
 */
export async function getPendingRevocationEtas(
  config: Config,
  parameters: GetPendingRevocationEtasParameters,
): Promise<GetPendingRevocationEtasReturnType> {
  const { chainId, delegator, delegate, selectors, batchSize = DEFAULT_BATCH_SIZE } = parameters;

  const etas = new Map<Hex, bigint>();
  if (selectors.length === 0) return etas;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  for (let start = 0; start < selectors.length; start += batchSize) {
    const batch = selectors.slice(start, start + batchSize);
    const results = await client.multicall({
      allowFailure: false,
      contracts: batch.map(
        (selector) =>
          ({
            address: addresses.instantLayerAddress,
            abi: instantLayerAbi,
            functionName: "pendingRevocationEta",
            args: [delegator.addr, delegate, selector],
          }) as const,
      ),
    });
    batch.forEach((selector, index) => {
      const eta = results[index];
      /** The mapping returns `0n` for a selector that was never scheduled. */
      if (eta !== undefined && eta !== 0n) etas.set(selector, eta);
    });
  }

  return etas;
}
