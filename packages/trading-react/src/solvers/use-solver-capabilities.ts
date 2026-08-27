"use client";

import {
  getSolverCapabilities,
  supportsGroupClose,
  supportsLimitOrder,
  type ConfigParameter,
  type SolverCapabilities,
  type SolverId,
} from "@symmio/trading-core";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverCapabilities} / {@link useSupportsGroupClose}. */
export interface UseSolverCapabilitiesParameters extends ConfigParameter {
  /** Chain to check; defaults to the connected chain. */
  chainId?: number;
  /** Solver to check; defaults to the chain's default solver. */
  solverId?: SolverId;
}

/**
 * Resolve the target solver's {@link SolverCapabilities}. Use it to gate UI on
 * what the solver supports (e.g. hide the group-close flow when unsupported).
 *
 * @example
 * ```tsx
 * const { groupClose } = useSolverCapabilities();
 * if (!groupClose) return null;
 * ```
 */
export function useSolverCapabilities(parameters: UseSolverCapabilitiesParameters = {}): SolverCapabilities {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return getSolverCapabilities(config, { chainId: parameters.chainId ?? chainId, solverId: parameters.solverId });
}

/**
 * Whether the target solver supports group close (close a market + side cohort
 * in one flow). Shorthand for `useSolverCapabilities().groupClose`; gate the
 * group-close toggle / step on it so rasa (cross-margin) hides it.
 */
export function useSupportsGroupClose(parameters: UseSolverCapabilitiesParameters = {}): boolean {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return supportsGroupClose(config, { chainId: parameters.chainId ?? chainId, solverId: parameters.solverId });
}

/**
 * Whether the target solver supports limit orders (majors / rasa). Shorthand for
 * `useSolverCapabilities().limitOrder`; gate the limit-order form on it.
 */
export function useSupportsLimitOrder(parameters: UseSolverCapabilitiesParameters = {}): boolean {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return supportsLimitOrder(config, { chainId: parameters.chainId ?? chainId, solverId: parameters.solverId });
}
