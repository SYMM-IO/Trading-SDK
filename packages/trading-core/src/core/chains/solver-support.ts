import { SymmError } from "../../shared/errors/symm-error";
import type { SolverId, SymmioSolverConfig, SymmioSolverKind } from "./types";

/**
 * The solver kinds the SDK can actually serve — one generated client and
 * behavior set per entry, and exactly one API generation per kind per SDK
 * release (a new generation ships as a new SDK release, never as config).
 * `createConfig` validates every configured solver against this list and throws
 * before returning, so a config can never point at a solver the SDK has no
 * client for. In particular this blocks registering a new `kind` (e.g. a second
 * solver family) before its strategy layer lands — without it, that solver's
 * reads would silently run the wrong decoder against its responses.
 *
 * Keep in sync with the {@link SymmioSolverKind} union: every union member
 * appears here, and vice versa.
 *
 * @internal
 */
export const SUPPORTED_SOLVER_KINDS: readonly SymmioSolverKind[] = ["enigma"];

/**
 * Throw when a configured solver's `kind` is not one the SDK can serve. Called
 * by `createConfig` for every solver on every chain, so an unsupported solver
 * fails fast at config-build time rather than at the first read that would
 * misinterpret its payload.
 *
 * @throws {SymmError} `UNSUPPORTED_SOLVER_KIND` when the kind is unknown.
 *
 * @internal
 */
export function assertSupportedSolver(chainId: number, solverId: SolverId, solver: SymmioSolverConfig): void {
  // The union types the field, but the runtime config may come from untyped
  // JSON, so treat a miss as possible.
  if (!(SUPPORTED_SOLVER_KINDS as readonly string[]).includes(solver.kind)) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_SOLVER_KIND",
      `createConfig: solver "${solverId}" on chain ${chainId} has unknown kind "${solver.kind}". Supported kinds: ${SUPPORTED_SOLVER_KINDS.join(", ")}. Add its strategy before registering it.`,
    );
  }
}
