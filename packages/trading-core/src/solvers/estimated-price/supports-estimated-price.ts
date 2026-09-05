import type { SolverId } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { assertSolverKind } from "../assert-solver-kind";

/**
 * Parameters for {@link supportsEstimatedPrice}.
 */
export interface SupportsEstimatedPriceParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Solver to check. Defaults to the chain's `defaultSolverId`. */
  solverId?: SolverId;
}

/**
 * Whether the resolved solver's API serves the `GET /estimated-price` endpoint
 * — the boolean twin of the `assertSolverKind` guard inside
 * `getEstimatedPrice` (the route is Enigma-only; Rasa's API 404s it).
 *
 * Use it where a throw is the wrong shape: TanStack `enabled` flags and UI
 * render gates. Returns `false` (never throws) when the chain or solver is
 * unknown.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver overrides.
 * @returns `true` when the solver serves `/estimated-price`.
 *
 * @example
 * ```ts
 * if (supportsEstimatedPrice(config, { solverId })) {
 *   const { estimatedPrice } = await getEstimatedPrice(config, { ... });
 * }
 * ```
 */
export function supportsEstimatedPrice(config: Config, parameters: SupportsEstimatedPriceParameters = {}): boolean {
  try {
    assertSolverKind(config.getSolver(parameters), "enigma", "getEstimatedPrice");
    return true;
  } catch {
    return false;
  }
}
