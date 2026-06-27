import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getNotionalCapAll,
  type GetNotionalCapAllParameters,
  type GetNotionalCapAllReturnType,
} from "./get-notional-cap-all";

/** Data resolved by the {@link getNotionalCapAllQueryOptions} query. */
export type GetNotionalCapAllData = GetNotionalCapAllReturnType;

/** Build the TanStack Query key for {@link getNotionalCapAllQueryOptions}. */
export function getNotionalCapAllQueryKey(options: Compute<GetNotionalCapAllParameters & ConfigKeyParameter>) {
  return ["getNotionalCapAll", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getNotionalCapAllQueryKey}. */
export type GetNotionalCapAllQueryKey = ReturnType<typeof getNotionalCapAllQueryKey>;

/** Options accepted by {@link getNotionalCapAllQueryOptions}. */
export type GetNotionalCapAllOptions = Compute<
  GetNotionalCapAllParameters &
    QueryParameter<GetNotionalCapAllData, Error, GetNotionalCapAllData, GetNotionalCapAllQueryKey>
>;

/** TanStack Query options returned by {@link getNotionalCapAllQueryOptions}. */
export type GetNotionalCapAllQueryOptions = SymmioQueryOptions<
  GetNotionalCapAllData,
  Error,
  GetNotionalCapAllData,
  GetNotionalCapAllQueryKey
>;

/**
 * Build TanStack Query options for {@link getNotionalCapAll}.
 *
 * @example
 * ```ts
 * useQuery(getNotionalCapAllQueryOptions(config, {}));
 * ```
 */
export function getNotionalCapAllQueryOptions(
  config: Config,
  options: GetNotionalCapAllOptions = {},
): GetNotionalCapAllQueryOptions {
  return {
    ...options.query,
    queryKey: getNotionalCapAllQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getNotionalCapAll(config, { chainId: options.chainId }),
  };
}
