"use client";

import {
  getAffiliateStateQueryOptions,
  type ConfigParameter,
  type GetAffiliateStateOptions,
  type GetAffiliateStateReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useAffiliateState}: the core query options (affiliate,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseAffiliateStateParameters = GetAffiliateStateOptions & ConfigParameter;

/** Return type of {@link useAffiliateState}. */
export type UseAffiliateStateReturnType = UseQueryResult<GetAffiliateStateReturnType, SymmioRequestError>;

/**
 * Read an affiliate's lifecycle state (`NONE` / `PENDING` / `ACTIVE` / `PAUSED`).
 * The query is disabled until `affiliate` is set. `chainId` defaults to the
 * connected chain. Pass a `query.refetchInterval` to poll while awaiting
 * approval. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: state } = useAffiliateState({
 *   affiliate,
 *   query: { refetchInterval: 15_000 },
 * });
 * ```
 */
export function useAffiliateState(parameters: UseAffiliateStateParameters = {}): UseAffiliateStateReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getAffiliateStateQueryOptions(config, {
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
  }) as UseAffiliateStateReturnType;
}
