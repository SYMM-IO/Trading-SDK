import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPartyAOpenPositionsBatch,
  type GetPartyAOpenPositionsBatchParameters,
  type GetPartyAOpenPositionsBatchReturnType,
} from "./get-party-a-open-positions-batch";

/** Data resolved by the {@link getPartyAOpenPositionsBatchQueryOptions} query. */
export type GetPartyAOpenPositionsBatchData = GetPartyAOpenPositionsBatchReturnType;

/**
 * Build the TanStack Query key for {@link getPartyAOpenPositionsBatchQueryOptions}.
 *
 * @param options - Query parameters (accounts, page size, flags) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPartyAOpenPositionsBatchQueryKey(
  options: Compute<GetPartyAOpenPositionsBatchParameters & ConfigKeyParameter>,
) {
  return ["getPartyAOpenPositionsBatch", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPartyAOpenPositionsBatchQueryKey}. */
export type GetPartyAOpenPositionsBatchQueryKey = ReturnType<typeof getPartyAOpenPositionsBatchQueryKey>;

/**
 * Options accepted by {@link getPartyAOpenPositionsBatchQueryOptions}: the
 * action's parameters, an optional cache scope, and TanStack overrides.
 */
export type GetPartyAOpenPositionsBatchOptions = Compute<
  GetPartyAOpenPositionsBatchParameters &
    QueryParameter<
      GetPartyAOpenPositionsBatchData,
      Error,
      GetPartyAOpenPositionsBatchData,
      GetPartyAOpenPositionsBatchQueryKey
    >
>;

/** TanStack Query options returned by {@link getPartyAOpenPositionsBatchQueryOptions}. */
export type GetPartyAOpenPositionsBatchQueryOptions = SymmioQueryOptions<
  GetPartyAOpenPositionsBatchData,
  Error,
  GetPartyAOpenPositionsBatchData,
  GetPartyAOpenPositionsBatchQueryKey
>;

/**
 * Build TanStack Query options for {@link getPartyAOpenPositionsBatch}. The
 * query stays idle while `partyAs` is empty — there is nothing to read.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getPartyAOpenPositionsBatchQueryOptions(config, { partyAs: virtualAccounts, chainId }));
 * ```
 */
export function getPartyAOpenPositionsBatchQueryOptions(
  config: Config,
  options: GetPartyAOpenPositionsBatchOptions,
): GetPartyAOpenPositionsBatchQueryOptions {
  return {
    ...options.query,
    queryKey: getPartyAOpenPositionsBatchQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.partyAs.length > 0 && (options.query?.enabled ?? true),
    queryFn: () =>
      getPartyAOpenPositionsBatch(config, {
        chainId: options.chainId,
        partyAs: options.partyAs,
        size: options.size,
        includeLiquidationStatus: options.includeLiquidationStatus,
        batchSize: options.batchSize,
      }),
  };
}
