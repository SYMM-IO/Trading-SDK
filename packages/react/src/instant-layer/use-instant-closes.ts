"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getInstantClosesQueryOptions,
  type ConfigParameter,
  type GetInstantClosesOptions,
  type GetInstantClosesReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useInstantCloses}: the core query options (partyA,
 * optional hedger `baseUrl`, chain id, TanStack `query` overrides incl.
 * `refetchInterval`) plus an optional `config`.
 */
export type UseInstantClosesParameters = GetInstantClosesOptions & ConfigParameter;

/** Return type of {@link useInstantCloses}. */
export type UseInstantClosesReturnType = UseQueryResult<GetInstantClosesReturnType, SymmioRequestError>;

/**
 * Read a sub-account's pending instant-close records from one hedger, with
 * caller-tunable polling via `query.refetchInterval`. `chainId` defaults to the
 * connected chain; disable the query from the consumer via `query.enabled`
 * (e.g. until a valid `partyA` is entered). Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useInstantCloses({ partyA, query: { refetchInterval: 3_000 } });
 * ```
 */
export function useInstantCloses(parameters: UseInstantClosesParameters): UseInstantClosesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getInstantClosesQueryOptions(config, {
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
  }) as UseInstantClosesReturnType;
}
