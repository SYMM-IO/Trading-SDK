import { SymmError } from "../../shared/errors/symm-error";
import { SUPPORTED_SOLVER_KINDS } from "./types";

/**
 * Throw when a configured solver's id (its registry key, which is its kind) is
 * not one the SDK can serve — not in {@link SUPPORTED_SOLVER_KINDS}, the single
 * source the `SymmioSolverKind` union is derived from. Called by `createConfig`
 * for every solver on every chain, so an unsupported solver fails fast at
 * config-build time rather than at the first read that would misinterpret its
 * payload.
 *
 * @throws {SymmError} `UNSUPPORTED_SOLVER_KIND` when the id is unknown.
 *
 * @internal
 */
export function assertSupportedSolver(chainId: number, solverId: string): void {
  // The union types the key, but the runtime config may come from untyped JSON,
  // so treat a miss as possible.
  if (!(SUPPORTED_SOLVER_KINDS as readonly string[]).includes(solverId)) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_SOLVER_KIND",
      `createConfig: solver "${solverId}" on chain ${chainId} is not a supported kind. Supported kinds: ${SUPPORTED_SOLVER_KINDS.join(", ")}. Add its strategy before registering it.`,
    );
  }
}
