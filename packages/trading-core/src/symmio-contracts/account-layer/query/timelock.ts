import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  cancelTimelockOp,
  clearTimelocks,
  executeTimelockOp,
  getSelectorTimelock,
  getTimelockScheduleState,
  scheduleTimelockOp,
  setupTimelocks,
  type CancelTimelockOpParameters,
  type ClearTimelocksParameters,
  type ExecuteTimelockOpParameters,
  type GetSelectorTimelockParameters,
  type GetTimelockScheduleStateParameters,
  type ScheduleTimelockOpParameters,
  type SetupTimelocksParameters,
  type TimelockScheduleState,
} from "../actions/timelock";
import type { SelectorTimelock } from "../types";

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

/** Build TanStack mutation options for {@link setupTimelocks}. */
export function setupTimelocksMutationOptions(config: Config) {
  return {
    mutationKey: ["setupTimelocks"] as const,
    retry: false as const,
    mutationFn: (variables: SetupTimelocksParameters) => setupTimelocks(config, variables),
  };
}

/** Build TanStack mutation options for {@link clearTimelocks}. */
export function clearTimelocksMutationOptions(config: Config) {
  return {
    mutationKey: ["clearTimelocks"] as const,
    retry: false as const,
    mutationFn: (variables: ClearTimelocksParameters) => clearTimelocks(config, variables),
  };
}

/** Build TanStack mutation options for {@link scheduleTimelockOp}. */
export function scheduleTimelockOpMutationOptions(config: Config) {
  return {
    mutationKey: ["scheduleTimelockOp"] as const,
    retry: false as const,
    mutationFn: (variables: ScheduleTimelockOpParameters) => scheduleTimelockOp(config, variables),
  };
}

/** Build TanStack mutation options for {@link cancelTimelockOp}. */
export function cancelTimelockOpMutationOptions(config: Config) {
  return {
    mutationKey: ["cancelTimelockOp"] as const,
    retry: false as const,
    mutationFn: (variables: CancelTimelockOpParameters) => cancelTimelockOp(config, variables),
  };
}

/** Build TanStack mutation options for {@link executeTimelockOp}. */
export function executeTimelockOpMutationOptions(config: Config) {
  return {
    mutationKey: ["executeTimelockOp"] as const,
    retry: false as const,
    mutationFn: (variables: ExecuteTimelockOpParameters) => executeTimelockOp(config, variables),
  };
}
