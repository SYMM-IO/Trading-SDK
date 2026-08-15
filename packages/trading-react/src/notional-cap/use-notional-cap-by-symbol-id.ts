"use client";

import {
  getNotionalCapBySymbolIdQueryOptions,
  type ConfigParameter,
  type GetNotionalCapBySymbolIdOptions,
  type GetNotionalCapBySymbolIdReturnType,
  type SymmioSolverKind,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Default polling cadence — 15 s, matching how often the solver re-publishes caps. */
export const DEFAULT_NOTIONAL_CAP_POLLING_MS = 15_000;

/**
 * Parameters for {@link useNotionalCapBySymbolId}: the core query options
 * (symbol id, chain id, TanStack `query` overrides) plus an optional `config`
 * and a `pollingInterval` knob layered on top of `query.refetchInterval`.
 */
export type UseNotionalCapBySymbolIdParameters<K extends SymmioSolverKind = SymmioSolverKind> =
  GetNotionalCapBySymbolIdOptions<K> &
    ConfigParameter & {
      /**
       * Polling cadence in milliseconds. Defaults to
       * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS}. Pass `false` to disable polling
       * (the query still refetches on focus / reconnect per TanStack defaults).
       */
      pollingInterval?: number | false;
    };

/** Return type of {@link useNotionalCapBySymbolId}, generic over the solver kind `K`. */
export type UseNotionalCapBySymbolIdReturnType<K extends SymmioSolverKind = SymmioSolverKind> = UseQueryResult<
  GetNotionalCapBySymbolIdReturnType<K>,
  SymmioRequestError
>;

/**
 * Read the solver's available-liquidity figures for a market. Polls every
 * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS} by default; pass
 * `pollingInterval: <ms>` to change the cadence or `pollingInterval: false` to
 * disable it.
 *
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useNotionalCapBySymbolId({ symbolId: 132 });
 * if (data?.kind === "enigma") console.log(data.availableToLong); // Enigma-only
 * ```
 */
export function useNotionalCapBySymbolId<K extends SymmioSolverKind = SymmioSolverKind>(
  parameters: UseNotionalCapBySymbolIdParameters<K>,
): UseNotionalCapBySymbolIdReturnType<K> {
  const { pollingInterval = DEFAULT_NOTIONAL_CAP_POLLING_MS, query, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getNotionalCapBySymbolIdQueryOptions<K>(config, {
    ...rest,
    chainId: rest.chainId ?? chainId,
    query: {
      refetchInterval: pollingInterval === false ? false : pollingInterval,
      ...query,
    },
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
  }) as UseNotionalCapBySymbolIdReturnType<K>;
}
