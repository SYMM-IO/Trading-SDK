import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPendingRevocationEtas,
  type GetPendingRevocationEtasParameters,
  type GetPendingRevocationEtasReturnType,
} from "../actions/get-pending-revocation-etas";

/** Data resolved by the {@link getPendingRevocationEtasQueryOptions} query. */
export type GetPendingRevocationEtasData = GetPendingRevocationEtasReturnType;

/**
 * Build the TanStack Query key for {@link getPendingRevocationEtasQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getPendingRevocationEtasQueryKey(
  options: Compute<ExactPartial<GetPendingRevocationEtasParameters> & ConfigKeyParameter> = {},
) {
  return ["getPendingRevocationEtas", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPendingRevocationEtasQueryKey}. */
export type GetPendingRevocationEtasQueryKey = ReturnType<typeof getPendingRevocationEtasQueryKey>;

/**
 * Options accepted by {@link getPendingRevocationEtasQueryOptions}: the action's
 * required read parameters, an optional chain id, and TanStack overrides.
 */
export type GetPendingRevocationEtasOptions = Compute<
  GetPendingRevocationEtasParameters &
    QueryParameter<GetPendingRevocationEtasData, Error, GetPendingRevocationEtasData, GetPendingRevocationEtasQueryKey>
>;

/** TanStack Query options returned by {@link getPendingRevocationEtasQueryOptions}. */
export type GetPendingRevocationEtasQueryOptions = SymmioQueryOptions<
  GetPendingRevocationEtasData,
  Error,
  GetPendingRevocationEtasData,
  GetPendingRevocationEtasQueryKey
>;

/**
 * Build TanStack Query options for {@link getPendingRevocationEtas}.
 *
 * A scheduled revocation only changes on-chain when someone initiates or
 * finalizes one, but the *meaning* of the returned ETA changes with the wall
 * clock — pair these options with a ticking comparison (or the
 * `usePendingRevocation` hook) rather than caching the derived "is it over yet?"
 * answer.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getPendingRevocationEtasQueryOptions(config, { delegator, delegate, selectors }));
 * ```
 */
export function getPendingRevocationEtasQueryOptions(
  config: Config,
  options: GetPendingRevocationEtasOptions,
): GetPendingRevocationEtasQueryOptions {
  return {
    ...options.query,
    queryKey: getPendingRevocationEtasQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, delegator, delegate, selectors, batchSize } = options;
      return getPendingRevocationEtas(config, { chainId, delegator, delegate, selectors, batchSize });
    },
  };
}
