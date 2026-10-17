import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getNotionalCapPage,
  type GetNotionalCapPageParameters,
  type GetNotionalCapPageReturnType,
} from "./get-notional-cap-page";

/**
 * One page of normalized cap rows and page-only totals resolved by the query.
 * @example const page: GetNotionalCapPageData = await getNotionalCapPage(config, {});
 */
export type GetNotionalCapPageData = GetNotionalCapPageReturnType;

/** Build a deployment- and page-specific query key.
 * @param options - Paging and deployment identity.
 * @returns A stable query-key tuple.
 * @throws Does not throw for valid options.
 * @example getNotionalCapPageQueryKey({ limit: 100, offset: 100 });
 */
export function getNotionalCapPageQueryKey(options: Compute<GetNotionalCapPageParameters & ConfigKeyParameter>) {
  return ["getNotionalCapPage", filterQueryOptions(options)] as const;
}

/**
 * Stable tuple identifying a page and its deployment in the query cache.
 * @example const key: GetNotionalCapPageQueryKey = getNotionalCapPageQueryKey({ offset: 100 });
 */
export type GetNotionalCapPageQueryKey = ReturnType<typeof getNotionalCapPageQueryKey>;

/**
 * Page/deployment inputs and TanStack Query overrides for the page read.
 * @example const options: GetNotionalCapPageOptions = { limit: 50, query: { enabled: false } };
 */
export type GetNotionalCapPageOptions = Compute<
  GetNotionalCapPageParameters &
    QueryParameter<GetNotionalCapPageData, Error, GetNotionalCapPageData, GetNotionalCapPageQueryKey>
>;

/**
 * Executable query options with a page-specific key and normalized cap result.
 * @example const query: GetNotionalCapPageQueryOptions = getNotionalCapPageQueryOptions(config, { offset: 100 });
 */
export type GetNotionalCapPageQueryOptions = SymmioQueryOptions<
  GetNotionalCapPageData,
  Error,
  GetNotionalCapPageData,
  GetNotionalCapPageQueryKey
>;

/**
 * Build TanStack Query options for one notional-cap page.
 * @param config - SDK configuration.
 * @param options - Paging, deployment and query overrides.
 * @returns Options whose key includes the page and deployment identity.
 * @throws {SymmError} When configuration cannot be resolved; the query function propagates action errors.
 *
 * @example
 * ```ts
 * useQuery(getNotionalCapPageQueryOptions(config, {}));
 * ```
 */
export function getNotionalCapPageQueryOptions(
  config: Config,
  options: GetNotionalCapPageOptions = {},
): GetNotionalCapPageQueryOptions {
  return {
    ...options.query,
    queryKey: getNotionalCapPageQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getNotionalCapPage(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        limit: options.limit,
        offset: options.offset,
      }),
  };
}
