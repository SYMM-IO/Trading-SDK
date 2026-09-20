import type { Hash } from "viem";
import type { Config } from "../core/config";

/**
 * The relay behind a transaction hash a transparent gasless write returned.
 *
 * A relayed write hands its caller an ordinary-looking transaction hash, but
 * that hash is only the relayer's **first** broadcast: a stuck nonce or a gas
 * bump makes the service replace it, and the replacement is the transaction
 * that actually lands. This is the handle back to the workflow, so a caller
 * waiting on the write can follow the request instead of a hash that may never
 * mine.
 */
export interface GaslessWriteRequest {
  /** Stable service tracking id — poll it with `getGaslessRequest`. */
  requestId: string;
  /** Which sub-service stores the request. A relayed write is always an operation relay. */
  service: "operations";
  /** The chain the relay was accepted on. */
  chainId: number;
  /** Protocol instance the relay was accepted on, or `null` for a proxy base that names none. */
  protocolInstance: string | null;
  /** The first broadcast hash — the one the write returned, and the registry key. */
  broadcastHash: Hash;
}

/**
 * How many relayed writes one `Config` remembers. A relayed write is looked up
 * once, immediately, by the write tail that received its hash; the map exists
 * to bridge that single hand-off, not to be a history. Oldest entries fall out
 * first so a long-lived page cannot grow it without bound.
 */
const MAX_TRACKED_WRITES = 64;

const registries = new WeakMap<Config, Map<Hash, GaslessWriteRequest>>();

/** Hashes compare case-insensitively: a relayer's hash casing is not load-bearing. */
function hashKey(hash: Hash): Hash {
  return hash.toLowerCase() as Hash;
}

/**
 * Record the relay a broadcast hash came from, so
 * {@link getGaslessWriteRequest} can resolve it later.
 *
 * @internal
 */
export function registerGaslessWriteRequest(config: Config, request: GaslessWriteRequest): void {
  let registry = registries.get(config);
  if (!registry) {
    registry = new Map();
    registries.set(config, registry);
  }
  const key = hashKey(request.broadcastHash);
  /** Re-inserting moves the entry to the end, so a refreshed write is never the next eviction. */
  registry.delete(key);
  registry.set(key, request);
  while (registry.size > MAX_TRACKED_WRITES) {
    const oldest = registry.keys().next();
    if (oldest.done) break;
    registry.delete(oldest.value);
  }
}

/**
 * Look up the relay request behind a transaction hash a write returned.
 *
 * Returns `null` for an ordinary wallet-submitted hash, which is what makes
 * this usable as a branch: a caller can treat every write the same way and only
 * follow the relay when there is one. The entry is written by the transparent
 * dispatcher the moment the relayer reports a broadcast, and it is remembered
 * per `Config` for the most recent relayed writes only.
 *
 * @param config - The SDK config the write ran under.
 * @param parameters - The transaction hash the write returned.
 * @returns The relay behind the hash, or `null` when it was not relayed (or is no longer remembered).
 *
 * @example
 * ```ts
 * const relayed = getGaslessWriteRequest(config, { hash });
 * const record = relayed
 *   ? await waitForGaslessRequest(config, { chainId: relayed.chainId, requestId: relayed.requestId })
 *   : undefined;
 * ```
 */
export function getGaslessWriteRequest(config: Config, parameters: { hash: Hash }): GaslessWriteRequest | null {
  return registries.get(config)?.get(hashKey(parameters.hash)) ?? null;
}
