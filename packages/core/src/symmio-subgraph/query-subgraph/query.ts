import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { querySubgraph, type QuerySubgraphParameters } from "./query-subgraph";

/** Query-key type produced by {@link getQuerySubgraphQueryKey}. */
export type QuerySubgraphQueryKey = readonly ["querySubgraph", Record<string, unknown>];

/**
 * Build the TanStack Query key for {@link querySubgraphQueryOptions}.
 *
 * The document is folded in as its serialized string so two different queries
 * (or the same query with different variables) get distinct cache entries.
 *
 * @param options - Query parameters (document, variables, subgraph, chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getQuerySubgraphQueryKey<TResult, TVariables>(
  options: Compute<QuerySubgraphParameters<TResult, TVariables> & ConfigKeyParameter>,
): QuerySubgraphQueryKey {
  const { document, ...rest } = options;
  return ["querySubgraph", filterQueryOptions({ ...rest, document: document.toString() })] as const;
}

/**
 * Options accepted by {@link querySubgraphQueryOptions}: the action's parameters
 * plus TanStack overrides.
 */
export type QuerySubgraphOptions<TResult, TVariables> = Compute<
  QuerySubgraphParameters<TResult, TVariables> & QueryParameter<TResult, Error, TResult, QuerySubgraphQueryKey>
>;

/** TanStack Query options returned by {@link querySubgraphQueryOptions}. */
export type QuerySubgraphQueryOptions<TResult> = SymmioQueryOptions<TResult, Error, TResult, QuerySubgraphQueryKey>;

/**
 * Build TanStack Query options for {@link querySubgraph}. The raw-GraphQL
 * counterpart to the curated query-options factories — feed the result straight
 * into `useQuery` / `queryClient.fetchQuery`.
 *
 * @param config - The SDK config.
 * @param options - The document, variables, optional subgraph/chain id, and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function querySubgraphQueryOptions<TResult, TVariables>(
  config: Config,
  options: QuerySubgraphOptions<TResult, TVariables>,
): QuerySubgraphQueryOptions<TResult> {
  return {
    ...options.query,
    queryKey: getQuerySubgraphQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      querySubgraph(config, {
        chainId: options.chainId,
        document: options.document,
        variables: options.variables,
        subgraph: options.subgraph,
      }),
  };
}
