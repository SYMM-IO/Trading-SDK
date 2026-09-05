"use client";

import {
  getMarketInfoQueryOptions,
  type ConfigParameter,
  type GetMarketInfoOptions,
  type GetMarketInfoReturnType,
  type SymmioSolverKind,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMarketInfo}: the core query options plus an optional
 * `config`. Generic over the solver kind `K` — a literal `solverId` narrows the
 * returned market-info type.
 */
export type UseMarketInfoParameters<K extends SymmioSolverKind = SymmioSolverKind> = GetMarketInfoOptions<K> &
  ConfigParameter;

/** Return type of {@link useMarketInfo}, generic over the solver kind `K`. */
export type UseMarketInfoReturnType<K extends SymmioSolverKind = SymmioSolverKind> = UseQueryResult<
  GetMarketInfoReturnType<K>,
  SymmioRequestError
>;

/**
 * Read per-market info from the active chain's solver in one call. The shape
 * diverges by solver — **Enigma** returns 24h volume + lifetime value plus
 * aggregate totals; **Rasa** returns price / 24h change / volume / notional cap.
 * Narrow on `data.kind`, or pass a literal `solverId` to narrow the type.
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useMarketInfo();
 * if (data?.kind === "enigma") console.log(data.totalValue24h);
 * ```
 */
export function useMarketInfo<K extends SymmioSolverKind = SymmioSolverKind>(
  parameters: UseMarketInfoParameters<K> = {},
): UseMarketInfoReturnType<K> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getMarketInfoQueryOptions<K>(config, {
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
  }) as UseMarketInfoReturnType<K>;
}
