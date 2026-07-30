"use client";

import {
  getInstantOpensQueryOptions,
  type ConfigParameter,
  type GetInstantOpensOptions,
  type GetInstantOpensReturnType,
  type SymmioSolverKind,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useInstantOpens}: the core query options (partyA,
 * optional hedger `baseUrl`, chain id, TanStack `query` overrides incl.
 * `refetchInterval`) plus an optional `config`. Generic over the solver kind `K`.
 */
export type UseInstantOpensParameters<K extends SymmioSolverKind = SymmioSolverKind> = GetInstantOpensOptions<K> &
  ConfigParameter;

/** Return type of {@link useInstantOpens}, generic over the solver kind `K`. */
export type UseInstantOpensReturnType<K extends SymmioSolverKind = SymmioSolverKind> = UseQueryResult<
  GetInstantOpensReturnType<K>,
  SymmioRequestError
>;

/**
 * Read a sub-account's pending instant-open records from one hedger, with
 * caller-tunable polling via `query.refetchInterval`. `chainId` defaults to the
 * connected chain; disable the query from the consumer via `query.enabled`
 * (e.g. until a valid `partyA` is entered). Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useInstantOpens({ partyA, query: { refetchInterval: 3_000 } });
 * ```
 */
export function useInstantOpens<K extends SymmioSolverKind = SymmioSolverKind>(
  parameters: UseInstantOpensParameters<K>,
): UseInstantOpensReturnType<K> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getInstantOpensQueryOptions<K>(config, {
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
  }) as UseInstantOpensReturnType<K>;
}
