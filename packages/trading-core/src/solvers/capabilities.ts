import type { SolverCapabilitiesConfig, SolverId } from "../core/chains/types";
import type { Config } from "../core/config";

/**
 * A solver's capability flags **resolved** to definite booleans — the total
 * version of the declared {@link SolverCapabilitiesConfig} (unset flags default
 * to `false`). Derived from the config type so the two never drift.
 *
 * TP/SL is **not** here: it is inferred from the presence of the solver's `tpsl`
 * block rather than a `capabilities` flag — use `supportsTpSl` for it.
 */
export type SolverCapabilities = Required<SolverCapabilitiesConfig>;

/**
 * Resolve a solver's capability flags. Non-throwing: an unknown chain/solver
 * yields all-`false`. Use it (or the {@link supportsGroupClose} /
 * {@link supportsLimitOrder} shorthands) to gate SDK flows and UI so an
 * unsupported solver degrades gracefully.
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
    const { capabilities } = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
    return {
      groupClose: capabilities?.groupClose ?? false,
      limitOrder: capabilities?.limitOrder ?? false,
    };
  } catch {
    return { groupClose: false, limitOrder: false };
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

/**
 * Whether the resolved solver supports {@link SolverCapabilities.limitOrder}.
 * Shorthand for `getSolverCapabilities(config, p).limitOrder`.
 *
 * @param config - The SDK config.
 * @param parameters - Optional `chainId` / `solverId`; both default to the chain's default solver.
 * @returns `true` when the solver supports limit orders.
 */
export function supportsLimitOrder(
  config: Config,
  parameters: { chainId?: number; solverId?: SolverId } = {},
): boolean {
  return getSolverCapabilities(config, parameters).limitOrder;
}
