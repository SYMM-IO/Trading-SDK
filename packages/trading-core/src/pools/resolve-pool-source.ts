import type { Config } from "../core/config";

/**
 * The subgraph `source` that scopes a query to a pool's book.
 *
 * A quote's `source` is the SYMMIO diamond it was opened against, which for the
 * lowcap Pools is simply the chain's `symmioAddress` — there is no separate
 * "lowcap diamond" to configure. Lower-cased because the subgraph stores
 * `Bytes` in lower case and an exact-match filter on a checksummed address
 * silently returns nothing.
 *
 * @param config - The SDK config.
 * @param chainId - Chain to resolve, or `undefined` for the config default.
 * @returns The lower-cased diamond address to filter on.
 *
 * @internal
 */
export function resolvePoolSource(config: Config, chainId?: number): string {
  return config.getChainConfig(chainId).addresses.symmioAddress.toLowerCase();
}
