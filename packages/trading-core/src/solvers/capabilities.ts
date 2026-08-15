import type { SolverId } from "../core/chains/types";
import type { Config } from "../core/config";

/**
 * Resolved capabilities of a solver — what SDK flows it supports. Derived from
 * the solver's registry config (its `tpsl` block and `capabilities` flags).
 */
export interface SolverCapabilities {
  /** Conditional orders (TP/SL) — the solver declares a `tpsl` handler block. */
  tpsl: boolean;
  /**
   * Group close — closing a whole market + side cohort of quotes in one flow.
   * From the solver's `capabilities.groupClose` flag (enigma only; rasa is
   * cross-margin and has no per-market/side grouping).
   */
  groupClose: boolean;
}

/**
 * Resolve a solver's capabilities. Non-throwing: an unknown chain/solver yields
 * all-`false`. Use it (or the {@link supportsGroupClose} shorthand) to gate SDK
 * flows and UI so an unsupported solver degrades gracefully.
 *
 * @param config - The SDK config.
 * @param parameters - Optional `chainId` / `solverId`; both default to the chain's default solver.
 * @returns The resolved {@link SolverCapabilities}.
 *
 * @example
 * ```ts
 * const { groupClose } = getSolverCapabilities(config, { chainId });
 * if (!groupClose) hideGroupCloseButton();
 * ```
 */
export function getSolverCapabilities(
  config: Config,
  parameters: { chainId?: number; solverId?: SolverId } = {},
): SolverCapabilities {
  try {
    const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
    return { tpsl: solver.tpsl !== undefined, groupClose: solver.capabilities?.groupClose ?? false };
  } catch {
    return { tpsl: false, groupClose: false };
  }
}

/**
 * Whether the resolved solver supports {@link SolverCapabilities.groupClose}.
 * Shorthand for `getSolverCapabilities(config, p).groupClose`.
 *
 * @param config - The SDK config.
 * @param parameters - Optional `chainId` / `solverId`; both default to the chain's default solver.
 * @returns `true` when the solver supports group close.
 */
export function supportsGroupClose(
  config: Config,
  parameters: { chainId?: number; solverId?: SolverId } = {},
): boolean {
  return getSolverCapabilities(config, parameters).groupClose;
}
