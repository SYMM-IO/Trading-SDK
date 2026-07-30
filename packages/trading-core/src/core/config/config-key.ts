import { hash } from "ohash";
import type { SymmioChainConfig } from "../chains";

/**
 * A short, stable fingerprint of a fully-resolved chain config. Derived purely
 * from the config's content — `ohash` serializes deterministically regardless of
 * key order — so the same config yields the same fingerprint across SSR,
 * reloads, and separate `Config` instances, which is what makes it safe to embed
 * in a TanStack query key.
 *
 * ALL query factories fold this into their keys — chain-scoped and
 * solver-facing alike. Solver-facing keys additionally carry the `solverId`
 * field (spread from their options), which is what keeps two solvers on the
 * same chain in separate cache entries; the hash handles freshness (any config
 * change, including a solver override, rotates it).
 *
 * @internal
 */
export function hashChainConfig(config: SymmioChainConfig): string {
  return hash(config);
}
