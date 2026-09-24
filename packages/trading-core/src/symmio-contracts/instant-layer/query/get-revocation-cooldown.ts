import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getRevocationCooldown,
  type GetRevocationCooldownParameters,
  type GetRevocationCooldownReturnType,
} from "../actions/get-revocation-cooldown";

/** Data resolved by the {@link getRevocationCooldownQueryOptions} query. */
export type GetRevocationCooldownData = GetRevocationCooldownReturnType;

/**
 * Build the TanStack Query key for {@link getRevocationCooldownQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getRevocationCooldownQueryKey(
  options: Compute<ExactPartial<GetRevocationCooldownParameters> & ConfigKeyParameter> = {},
) {
  return ["getRevocationCooldown", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getRevocationCooldownQueryKey}. */
export type GetRevocationCooldownQueryKey = ReturnType<typeof getRevocationCooldownQueryKey>;

/**
 * Options accepted by {@link getRevocationCooldownQueryOptions}: an optional
 * chain id and TanStack overrides.
 */
export type GetRevocationCooldownOptions = Compute<
  GetRevocationCooldownParameters &
    QueryParameter<GetRevocationCooldownData, Error, GetRevocationCooldownData, GetRevocationCooldownQueryKey>
>;

/** TanStack Query options returned by {@link getRevocationCooldownQueryOptions}. */
export type GetRevocationCooldownQueryOptions = SymmioQueryOptions<
  GetRevocationCooldownData,
  Error,
  GetRevocationCooldownData,
  GetRevocationCooldownQueryKey
>;

/**
 * Build TanStack Query options for {@link getRevocationCooldown}.
 *
 * @param config - The SDK config.
 * @param options - Optional chain id and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getRevocationCooldownQueryOptions(config, {}));
 * ```
 */
export function getRevocationCooldownQueryOptions(
  config: Config,
  options: GetRevocationCooldownOptions = {},
): GetRevocationCooldownQueryOptions {
  return {
    ...options.query,
    queryKey: getRevocationCooldownQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getRevocationCooldown(config, { chainId: options.chainId }),
  };
}
