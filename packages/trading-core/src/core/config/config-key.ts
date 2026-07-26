import { hash } from "ohash";
import type { SolverId, SymmioChainConfig, SymmioSolverConfig } from "../chains";

/**
 * A short, stable fingerprint of a fully-resolved chain config. Derived purely
 * from the config's content — `ohash` serializes deterministically regardless of
 * key order — so the same config yields the same fingerprint across SSR,
 * reloads, and separate `Config` instances, which is what makes it safe to embed
 * in a TanStack query key.
 *
 * @internal
 */
export function hashChainConfig(config: SymmioChainConfig): string {
  return hash(config);
}

/**
 * A short, stable fingerprint of ONE resolved solver on a chain — folds
 * `chainId`, `solverId`, and the solver's own config (`kind`, `version`, `url`,
 * `address`, `tpsl`). Two solvers on the same chain get distinct fingerprints,
 * and changing one solver's config never changes another's — unlike
 * {@link hashChainConfig}, which hashes the whole chain (so a per-solver override
 * would over-invalidate every solver's queries).
 *
 * Solver-facing query factories fold this into their keys (via `config.getSolverKey`)
 * instead of {@link hashChainConfig}, so switching `solverId` — or overriding one
 * solver's endpoints — rotates only that solver's cache and never collides with
 * another solver's entries.
 *
 * @internal
 */
export function hashSolverConfig(chainId: number, solverId: SolverId, solver: SymmioSolverConfig): string {
  return hash({ chainId, solverId, solver });
}
