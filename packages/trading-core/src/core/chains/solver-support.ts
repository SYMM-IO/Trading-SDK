import { SymmError } from "../../shared/errors/symm-error";
import type { SolverId, SymmioSolverConfig, SymmioSolverKind, SymmioSolverVersion } from "./types";

/**
 * The `(kind, version)` pairs the SDK can actually serve — one generated client
 * and behavior set per entry. `createConfig` validates every configured solver
 * against this table and throws before returning, so a config can never point at
 * a solver the SDK has no client for. In particular this blocks registering a new
 * `kind` (e.g. a second solver family) before its strategy layer lands — without
 * it, that solver's reads would silently run the wrong decoder against its
 * responses.
 *
 * Keep in sync with the {@link SymmioSolverKind} / {@link SymmioSolverVersion}
 * unions: every union member appears here, and vice versa.
 *
 * @internal
 */
export const SUPPORTED_SOLVER_VERSIONS: Record<SymmioSolverKind, readonly SymmioSolverVersion[]> = {
  enigma: ["v1"],
};

/**
 * Throw when a configured solver's `(kind, version)` is not one the SDK can
 * serve. Called by `createConfig` for every solver on every chain, so an
 * unsupported solver fails fast at config-build time rather than at the first
 * read that would misinterpret its payload.
 *
 * @throws {SymmError} `UNSUPPORTED_SOLVER_KIND` when the kind is unknown, or
 *   `UNSUPPORTED_SOLVER_VERSION` when the version is not supported for the kind.
 *
 * @internal
 */
export function assertSupportedSolver(chainId: number, solverId: SolverId, solver: SymmioSolverConfig): void {
  // The lookup is typed total (Record<SymmioSolverKind, …>), but the runtime
  // config may come from untyped JSON, so treat a miss as possible.
  const versions = (SUPPORTED_SOLVER_VERSIONS as Record<string, readonly SymmioSolverVersion[] | undefined>)[
    solver.kind
  ];
  if (!versions) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_SOLVER_KIND",
      `createConfig: solver "${solverId}" on chain ${chainId} has unknown kind "${solver.kind}". Supported kinds: ${Object.keys(SUPPORTED_SOLVER_VERSIONS).join(", ")}. Add its strategy before registering it.`,
    );
  }
  if (!versions.includes(solver.version)) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_SOLVER_VERSION",
      `createConfig: solver "${solverId}" on chain ${chainId} (kind "${solver.kind}") has unsupported version "${solver.version}". Supported versions: ${versions.join(", ")}.`,
    );
  }
}
