"use client";

import {
  createLowcapCandleSource,
  type CandleSource,
  type ConfigParameter,
  type LowcapCandleSourceParameters,
} from "@symmio/trading-core";
import { useMemo } from "react";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Options for {@link useLowcapCandleSource}, including an optional SDK config override. */
export type UseLowcapCandleSourceParameters = LowcapCandleSourceParameters & ConfigParameter;

/**
 * Create a memoized lowcap price-service candle source.
 * Flat candles are filtered by default; pass `includeFlat: true` to include them.
 * Unsupported deployments fail through the history/stream hooks' error state.
 * Pin chainId when the chart should not follow wallet chain changes.
 *
 * @param parameters - Chain, solver, flat-candle policy, refresh interval, and config override.
 * @returns A source stable until its config or option values change.
 * @example
 * ```tsx
 * const source = useLowcapCandleSource();
 * const history = useCandles({ source, marketName, resolution: "1h", from, to });
 * ```
 */
export function useLowcapCandleSource(parameters: UseLowcapCandleSourceParameters = {}): CandleSource {
  const config = useSymmioConfig(parameters);
  const activeChainId = useSymmioChainId();
  const { chainId = activeChainId, solverId, includeFlat, refreshIntervalMs } = parameters;
  return useMemo(
    () => createLowcapCandleSource(config, { chainId, solverId, includeFlat, refreshIntervalMs }),
    [config, chainId, solverId, includeFlat, refreshIntervalMs],
  );
}
