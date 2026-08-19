"use client";

import { supportsTpSl, type ConfigParameter, type SolverId } from "@symmio/trading-core";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useTpSlSupported}. */
export interface UseTpSlSupportedParameters extends ConfigParameter {
  /** Chain to check; defaults to the connected chain. */
  chainId?: number;
  /** Solver to check; defaults to the chain's default solver. */
  solverId?: SolverId;
}

/**
 * Whether TP/SL is available on the target chain/solver — i.e. the resolved
 * solver declares a conditional-order handler. Use it to hide or disable TP/SL
 * UI (cells, modals, the TP/SL flow) so a solver without a handler (e.g. a rasa
 * solver on Base) degrades gracefully instead of erroring.
 *
 * @example
 * ```tsx
 * const tpslSupported = useTpSlSupported();
 * if (!tpslSupported) return null; // hide the TP/SL cell
 * ```
 */
export function useTpSlSupported(parameters: UseTpSlSupportedParameters = {}): boolean {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return supportsTpSl(config, { chainId: parameters.chainId ?? chainId, solverId: parameters.solverId });
}
