"use client";

import {
  getTradeVolumeQueryOptions,
  type ConfigParameter,
  type GetTradeVolumeOptions,
  type GetTradeVolumeReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useTradeVolume}: the core query options (required
 * `symbolId`, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseTradeVolumeParameters = GetTradeVolumeOptions & ConfigParameter;

/** Return type of {@link useTradeVolume}. */
export type UseTradeVolumeReturnType = UseQueryResult<GetTradeVolumeReturnType, SymmioRequestError>;

/**
 * Read the last N daily trade-volume rows for one market from the active chain's
 * enigma solver. Rows are ascending by day. The query is disabled until a
 * positive `symbolId` is supplied.
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useTradeVolume({ symbolId: 1 });
 * const latest = data?.at(-1);
 * ```
 */
export function useTradeVolume(parameters: UseTradeVolumeParameters): UseTradeVolumeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTradeVolumeQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseTradeVolumeReturnType;
}
