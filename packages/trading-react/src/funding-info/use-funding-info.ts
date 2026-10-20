"use client";

import {
  getFundingInfoQueryOptions,
  type ConfigParameter,
  type GetFundingInfoOptions,
  type GetFundingInfoReturnType,
  type SymmioSolverKind,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useFundingInfo}: the core query options plus an optional
 * `config`.
 */
export type UseFundingInfoParameters<K extends SymmioSolverKind = SymmioSolverKind> = GetFundingInfoOptions<K> &
  ConfigParameter;

/** Return type of {@link useFundingInfo}. */
export type UseFundingInfoReturnType<K extends SymmioSolverKind = SymmioSolverKind> = UseQueryResult<
  GetFundingInfoReturnType<K>,
  SymmioRequestError
>;

/**
 * Read per-market funding rates from the active chain's solver in one call.
 * Surfaces the next-epoch long/short funding rate, next funding time, and epoch
 * length for every market (or only the requested Enigma `symbolIds` or Rasa `symbols`).
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 *
 * @param parameters - Deployment, optional config and query overrides.
 * @returns Query state; narrow rows on kind, or pass a literal solverId for narrowed data.
 * @throws {SymmioRequestError} Action failures appear in the query error state.
 * @example
 * ```tsx
 * const { data } = useFundingInfo({ solverId: "enigma" });
 * const btc = data?.find((f) => f.symbolId === 1);
 * ```
 */
export function useFundingInfo<K extends SymmioSolverKind = SymmioSolverKind>(
  parameters: UseFundingInfoParameters<K> = {},
): UseFundingInfoReturnType<K> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getFundingInfoQueryOptions<K>(config, {
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
  }) as UseFundingInfoReturnType<K>;
}
