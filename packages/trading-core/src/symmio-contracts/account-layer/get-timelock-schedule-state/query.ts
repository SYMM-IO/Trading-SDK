import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import type { GetTimelockScheduleStateParameters, TimelockScheduleState } from "../timelock-types";
import { getTimelockScheduleState } from "./get-timelock-schedule-state";

/** Build the stable TanStack key for a schedule-state query. */
export function getTimelockScheduleStateQueryKey(
  options: Compute<ExactPartial<GetTimelockScheduleStateParameters> & ConfigKeyParameter> = {},
) {
  return ["getTimelockScheduleState", filterQueryOptions(options)] as const;
}
/** Query-key type returned by {@link getTimelockScheduleStateQueryKey}. */
export type GetTimelockScheduleStateQueryKey = ReturnType<typeof getTimelockScheduleStateQueryKey>;
/** Required action inputs plus TanStack overrides for a schedule-state query. */
export type GetTimelockScheduleStateOptions = Compute<
  GetTimelockScheduleStateParameters &
    QueryParameter<TimelockScheduleState, Error, TimelockScheduleState, GetTimelockScheduleStateQueryKey>
>;
/** TanStack query options returned by {@link getTimelockScheduleStateQueryOptions}. */
export type GetTimelockScheduleStateQueryOptions = SymmioQueryOptions<
  TimelockScheduleState,
  Error,
  TimelockScheduleState,
  GetTimelockScheduleStateQueryKey
>;

/**
 * Build TanStack Query options for {@link getTimelockScheduleState}.
 *
 * @param config - SDK configuration used by the query function.
 * @param options - Required root account and raw calldata plus query overrides.
 * @returns Options for `useQuery` or `queryClient.fetchQuery`.
 */
export function getTimelockScheduleStateQueryOptions(
  config: Config,
  options: GetTimelockScheduleStateOptions,
): GetTimelockScheduleStateQueryOptions {
  return {
    ...options.query,
    queryKey: getTimelockScheduleStateQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getTimelockScheduleState(config, options),
  };
}
