import { hash } from "ohash";
import type { SymmioChainConfig } from "../chains";

/**
 * A short, stable fingerprint of a fully-resolved chain config. Derived purely
 * from the config's content — `ohash` serializes deterministically regardless of
 * key order — so the same config yields the same fingerprint across SSR,
 * reloads, and separate `Config` instances, which is what makes it safe to embed
 * in a TanStack query key.
 *
 * Solver-facing query factories do NOT use this hash — they fold the plain
 * `config.getSolverKey()` composite (`"<chainId>:<solverId>"`) instead, so two
 * solvers on the same chain never share a cache entry.
 *
 * @internal
 */
export function hashChainConfig(config: SymmioChainConfig): string {
  return hash(config);
}
