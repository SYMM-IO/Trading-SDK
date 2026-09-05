import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getCoolDownsOfMA,
  type GetCoolDownsOfMAParameters,
  type GetCoolDownsOfMAReturnType,
} from "../actions/get-cool-downs-of-ma";

/** Data resolved by the {@link getCoolDownsOfMAQueryOptions} query. */
export type GetCoolDownsOfMAData = GetCoolDownsOfMAReturnType;

/**
 * Build the TanStack Query key for {@link getCoolDownsOfMAQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getCoolDownsOfMAQueryKey(
  options: Compute<ExactPartial<GetCoolDownsOfMAParameters> & ConfigKeyParameter> = {},
) {
  return ["getCoolDownsOfMA", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getCoolDownsOfMAQueryKey}. */
export type GetCoolDownsOfMAQueryKey = ReturnType<typeof getCoolDownsOfMAQueryKey>;

/** Options accepted by {@link getCoolDownsOfMAQueryOptions}. */
export type GetCoolDownsOfMAOptions = Compute<
  ExactPartial<GetCoolDownsOfMAParameters> &
    QueryParameter<GetCoolDownsOfMAData, Error, GetCoolDownsOfMAData, GetCoolDownsOfMAQueryKey>
>;

/** TanStack Query options returned by {@link getCoolDownsOfMAQueryOptions}. */
export type GetCoolDownsOfMAQueryOptions = SymmioQueryOptions<
  GetCoolDownsOfMAData,
  Error,
  GetCoolDownsOfMAData,
  GetCoolDownsOfMAQueryKey
>;

/**
 * Build TanStack Query options for {@link getCoolDownsOfMA} — the protocol
 * cooldown periods (index 1 is the force-cancel cooldown). These rarely change,
 * so a long `staleTime` is appropriate at the call site.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getCoolDownsOfMAQueryOptions(config));
 * ```
 */
export function getCoolDownsOfMAQueryOptions(
  config: Config,
  options: GetCoolDownsOfMAOptions = {},
): GetCoolDownsOfMAQueryOptions {
  return {
    ...options.query,
    queryKey: getCoolDownsOfMAQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getCoolDownsOfMA(config, { chainId: options.chainId }),
  };
}
