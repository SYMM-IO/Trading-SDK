import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getDeallocateDebounceTime,
  type GetDeallocateDebounceTimeParameters,
  type GetDeallocateDebounceTimeReturnType,
} from "./get-deallocate-debounce-time";

/** Query data returned by {@link getDeallocateDebounceTimeQueryOptions}. */
export type GetDeallocateDebounceTimeData = GetDeallocateDebounceTimeReturnType;

/**
 * Build the query key for {@link getDeallocateDebounceTime}.
 *
 * @param options - Action parameters and optional deployment cache scope.
 * @returns A stable query key.
 */
export function getDeallocateDebounceTimeQueryKey(
  options: Compute<GetDeallocateDebounceTimeParameters & ConfigKeyParameter> = {},
) {
  return ["getDeallocateDebounceTime", filterQueryOptions(options)] as const;
}

/** Key returned by {@link getDeallocateDebounceTimeQueryKey}. */
export type GetDeallocateDebounceTimeQueryKey = ReturnType<typeof getDeallocateDebounceTimeQueryKey>;

/** Action parameters and query overrides for {@link getDeallocateDebounceTimeQueryOptions}. */
export type GetDeallocateDebounceTimeOptions = Compute<
  GetDeallocateDebounceTimeParameters &
    QueryParameter<
      GetDeallocateDebounceTimeData,
      Error,
      GetDeallocateDebounceTimeData,
      GetDeallocateDebounceTimeQueryKey
    >
>;

/** TanStack options returned by {@link getDeallocateDebounceTimeQueryOptions}. */
export type GetDeallocateDebounceTimeQueryOptions = SymmioQueryOptions<
  GetDeallocateDebounceTimeData,
  Error,
  GetDeallocateDebounceTimeData,
  GetDeallocateDebounceTimeQueryKey
>;

/**
 * Build deployment-scoped TanStack query options for {@link getDeallocateDebounceTime}.
 * An unsupported chain surfaces a {@link SymmError} from the query function.
 *
 * @param config - SDK configuration.
 * @param options - Action parameters and optional TanStack overrides.
 * @returns Query options with the SDK-owned function and key.
 *
 * @example
 * ```ts
 * useQuery(getDeallocateDebounceTimeQueryOptions(config));
 * ```
 */
export function getDeallocateDebounceTimeQueryOptions(
  config: Config,
  options: GetDeallocateDebounceTimeOptions = {},
): GetDeallocateDebounceTimeQueryOptions {
  return {
    ...options.query,
    queryKey: getDeallocateDebounceTimeQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getDeallocateDebounceTime(config, { chainId: options.chainId }),
  };
}
