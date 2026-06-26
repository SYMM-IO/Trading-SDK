"use client";

import {
  getInstantOpenQuoteIdQueryOptions,
  type ConfigParameter,
  type GetInstantOpenQuoteIdOptions,
  type GetInstantOpenQuoteIdReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useInstantOpenQuoteId}: the core query options
 * (tempQuoteId, optional hedger `baseUrl`, chain id, TanStack `query`
 * overrides) plus an optional `config`.
 */
export type UseInstantOpenQuoteIdParameters = GetInstantOpenQuoteIdOptions & ConfigParameter;

/** Return type of {@link useInstantOpenQuoteId}. */
export type UseInstantOpenQuoteIdReturnType = UseQueryResult<GetInstantOpenQuoteIdReturnType, SymmioRequestError>;

/**
 * Resolve the on-chain quote id for a hedger temp id — the reconciliation
 * handoff for a pending instant open. Returns `null` until the trade is anchored
 * on-chain; poll via `query.refetchInterval` and disable once a non-null id
 * arrives. `chainId` defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: quoteId } = useInstantOpenQuoteId({
 *   tempQuoteId,
 *   query: { refetchInterval: (q) => (q.state.data == null ? 2_000 : false) },
 * });
 * ```
 */
export function useInstantOpenQuoteId(parameters: UseInstantOpenQuoteIdParameters): UseInstantOpenQuoteIdReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getInstantOpenQuoteIdQueryOptions(config, {
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
  }) as UseInstantOpenQuoteIdReturnType;
}
