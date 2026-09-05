import type { SolverId } from "../core/chains/types";
import type { Config } from "../core/config";

/**
 * Whether the resolved solver declares a `tpsl` handler block — i.e. whether
 * TP/SL is available on this chain/solver.
 *
 * Non-throwing companion to the internal `resolveTpSlConfig` (which throws
 * `TPSL_NOT_CONFIGURED`). Use it to gate TP/SL reads, subscriptions, and UI so a
 * solver without a conditional-order handler (e.g. a rasa solver on Base)
 * degrades gracefully instead of crashing.
 *
 * @param config - The SDK config.
 * @param parameters - Optional `chainId` / `solverId`; both default to the chain's default solver.
 * @returns `true` when the resolved solver has a `tpsl` block, else `false` (including unknown chain/solver).
 *
 * @example
 * ```ts
 * if (supportsTpSl(config, { chainId })) {
 *   // read / subscribe / render TP/SL
 * }
 * ```
 */
export function supportsTpSl(config: Config, parameters: { chainId?: number; solverId?: SolverId } = {}): boolean {
  try {
    return config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId }).tpsl !== undefined;
  } catch {
    return false;
  }
}
