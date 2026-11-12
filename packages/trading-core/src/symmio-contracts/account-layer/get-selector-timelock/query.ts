import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import type { GetSelectorTimelockParameters } from "../timelock-types";
import type { SelectorTimelock } from "../types";
import { getSelectorTimelock } from "./get-selector-timelock";

/** Build the stable TanStack key for a selector-policy query. */
export function getSelectorTimelockQueryKey(
  options: Compute<ExactPartial<GetSelectorTimelockParameters> & ConfigKeyParameter> = {},
) {
  return ["getSelectorTimelock", filterQueryOptions(options)] as const;
}
/** Query-key type returned by {@link getSelectorTimelockQueryKey}. */
export type GetSelectorTimelockQueryKey = ReturnType<typeof getSelectorTimelockQueryKey>;
/** Required action inputs plus TanStack overrides for a selector-policy query. */
export type GetSelectorTimelockOptions = Compute<
  GetSelectorTimelockParameters & QueryParameter<SelectorTimelock, Error, SelectorTimelock, GetSelectorTimelockQueryKey>
>;
/** TanStack query options returned by {@link getSelectorTimelockQueryOptions}. */
export type GetSelectorTimelockQueryOptions = SymmioQueryOptions<
  SelectorTimelock,
  Error,
  SelectorTimelock,
  GetSelectorTimelockQueryKey
>;

/**
 * Build TanStack Query options for {@link getSelectorTimelock}.
 *
 * @param config - SDK configuration used by the query function.
 * @param options - Required root account and selector plus query overrides.
 * @returns Options for `useQuery` or `queryClient.fetchQuery`.
 */
export function getSelectorTimelockQueryOptions(
  config: Config,
  options: GetSelectorTimelockOptions,
): GetSelectorTimelockQueryOptions {
  return {
    ...options.query,
    queryKey: getSelectorTimelockQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getSelectorTimelock(config, options),
  };
}
