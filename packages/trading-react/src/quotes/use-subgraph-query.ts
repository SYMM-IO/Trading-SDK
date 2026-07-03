"use client";

import { querySubgraphQueryOptions, type ConfigParameter, type QuerySubgraphOptions } from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSubgraphQuery}: the raw-GraphQL query options
 * (document, variables, optional subgraph/chain id, TanStack `query` overrides)
 * plus an optional `config`.
 */
export type UseSubgraphQueryParameters<TResult, TVariables> = QuerySubgraphOptions<TResult, TVariables> &
  ConfigParameter;

/** Return type of {@link useSubgraphQuery}. */
export type UseSubgraphQueryReturnType<TResult> = UseQueryResult<TResult, SymmioRequestError>;

/**
 * Run an arbitrary typed GraphQL document against a configured SYMMIO subgraph
 * (default `analytics`) — the raw escape hatch behind the curated subgraph hooks.
 * Pass a graphql-codegen `TypedDocumentString` for full type inference, or a raw
 * string with explicit generics. `chainId` defaults to the connected chain;
 * errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useSubgraphQuery({ document: MY_DOC, variables: { id } });
 * ```
 */
export function useSubgraphQuery<TResult, TVariables = Record<string, unknown>>(
  parameters: UseSubgraphQueryParameters<TResult, TVariables>,
): UseSubgraphQueryReturnType<TResult> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = querySubgraphQueryOptions(config, {
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
  }) as UseSubgraphQueryReturnType<TResult>;
}
