import type { DefaultError, QueryKey, QueryObserverOptions } from "@tanstack/query-core";

/**
 * Optional TanStack Query overrides accepted by an SDK query-options factory.
 *
 * The `queryKey` and `queryFn` are owned by the factory, so they are omitted
 * here — a consumer may still pass `staleTime`, `gcTime`, `select`, `enabled`,
 * `retry`, etc. through the `query` property.
 *
 * @example
 * ```ts
 * useMarkets({ query: { staleTime: 30_000, refetchOnWindowFocus: false } });
 * ```
 */
export interface QueryParameter<
  queryFnData = unknown,
  error = DefaultError,
  data = queryFnData,
  queryKey extends QueryKey = QueryKey,
> {
  query?: Partial<
    Omit<
      QueryObserverOptions<queryFnData, error, data, queryFnData, queryKey>,
      "queryFn" | "queryKey" | "queryHash" | "queryKeyHashFn"
    >
  >;
}

/**
 * The object an SDK query-options factory returns: a fully-formed TanStack
 * query options bag with the SDK's `queryKey`, `queryFn`, and `enabled` set,
 * plus any consumer `query` overrides merged in.
 *
 * Declared explicitly (rather than inferred) so the generated `.d.ts` stays
 * portable — it names `QueryObserverOptions` instead of inlining query-core's
 * internal helper types.
 */
export type SymmioQueryOptions<
  queryFnData = unknown,
  error = DefaultError,
  data = queryFnData,
  queryKey extends QueryKey = QueryKey,
> = Partial<
  Omit<
    QueryObserverOptions<queryFnData, error, data, queryFnData, queryKey>,
    "queryFn" | "queryKey" | "queryHash" | "queryKeyHashFn"
  >
> & {
  queryKey: queryKey;
  queryFn: () => Promise<queryFnData>;
};
