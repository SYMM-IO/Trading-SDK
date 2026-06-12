"use client";

import {
  getQuoteQueryOptions,
  type ConfigParameter,
  type GetQuoteOptions,
  type GetQuoteReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useQuote}: the core query options (quote id, chain id,
 * TanStack `query` overrides) plus an optional `config`.
 */
export type UseQuoteParameters = GetQuoteOptions & ConfigParameter;

/** Return type of {@link useQuote}. */
export type UseQuoteReturnType = UseQueryResult<GetQuoteReturnType, SymmioRequestError>;

/**
 * Read a single `Quote` by id from the SYMMIO core. Resolves to `null` when no
 * quote exists with that id. The query is disabled until `quoteId` is set.
 * `chainId` defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: quote } = useQuote({ quoteId: 42n });
 * ```
 */
export function useQuote(parameters: UseQuoteParameters = {}): UseQuoteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getQuoteQueryOptions(config, {
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
  }) as UseQuoteReturnType;
}
