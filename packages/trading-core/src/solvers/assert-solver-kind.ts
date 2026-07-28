import type { SymmioSolverConfig, SymmioSolverKind } from "../core/chains";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Throw when the resolved solver's `kind` cannot serve an action.
 *
 * Kind-exclusive endpoints (e.g. the Rasa-only reads) call this before hitting
 * the wire, so an unsupported solver fails fast with a typed
 * `UNSUPPORTED_BY_SOLVER` error instead of surfacing a vendor 404.
 *
 * @param solver - The solver resolved via `config.getSolver`.
 * @param kind - The solver kind the action requires.
 * @param action - Action name used in the error message.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the kinds differ.
 */
export function assertSolverKind(solver: SymmioSolverConfig, kind: SymmioSolverKind, action: string): void {
  if (solver.kind !== kind) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_BY_SOLVER",
      `${action}: solver "${solver.name}" (kind "${solver.kind}") does not support this endpoint — it requires a "${kind}" solver.`,
    );
  }
}
