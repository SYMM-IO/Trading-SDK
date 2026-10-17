import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getFundingInfo, type GetFundingInfoParameters, type GetFundingInfoReturnType } from "./get-funding-info";

/** Data resolved by the {@link getFundingInfoQueryOptions} query. */
export type GetFundingInfoData = GetFundingInfoReturnType;

/**
 * Build a funding cache key including the symbol-ID filter and deployment identity.
 * @param options - Optional deployment and symbol IDs; query overrides are excluded.
 * @returns A stable query-key tuple.
 * @throws Does not throw for valid options.
 * @example getFundingInfoQueryKey({ symbolIds: [117, 185] });
 */
export function getFundingInfoQueryKey(options: Compute<GetFundingInfoParameters & ConfigKeyParameter> = {}) {
  return ["getFundingInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getFundingInfoQueryKey}. */
export type GetFundingInfoQueryKey = ReturnType<typeof getFundingInfoQueryKey>;

/** Options accepted by {@link getFundingInfoQueryOptions}. */
export type GetFundingInfoOptions = Compute<
  GetFundingInfoParameters & QueryParameter<GetFundingInfoData, Error, GetFundingInfoData, GetFundingInfoQueryKey>
>;

/** TanStack Query options returned by {@link getFundingInfoQueryOptions}. */
export type GetFundingInfoQueryOptions = SymmioQueryOptions<
  GetFundingInfoData,
  Error,
  GetFundingInfoData,
  GetFundingInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getFundingInfo}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters (optional `chainId` / `symbolIds`) and TanStack overrides.
 * @throws {SymmError} When configuration cannot be resolved; the query function propagates action errors.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getFundingInfoQueryOptions(config, {}));
 * ```
 */
export function getFundingInfoQueryOptions(
  config: Config,
  options: GetFundingInfoOptions = {},
): GetFundingInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getFundingInfoQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getFundingInfo(config, { chainId: options.chainId, solverId: options.solverId, symbolIds: options.symbolIds }),
  };
}
