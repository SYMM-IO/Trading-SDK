import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { getGaslessBatchFeeQuoteQueryKey } from "../get-gasless-batch-fee-quote";
import { getGaslessBatchFunding } from "./get-gasless-batch-funding";
import type { GetGaslessBatchFundingParameters, GetGaslessBatchFundingReturnType } from "./types";

/** Data resolved by the batch-funding query. */
export type GetGaslessBatchFundingData = GetGaslessBatchFundingReturnType;

/**
 * Key a funding preview by config, chain, account, encoded calls and balance movements.
 * @param options - Partial funding inputs and optional config identity.
 * @returns Stable query key; unencodable calls are deferred to the query function.
 */
export function getGaslessBatchFundingQueryKey(
  options: Compute<ExactPartial<GetGaslessBatchFundingParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessBatchFunding", getGaslessBatchFeeQuoteQueryKey(options)[1]] as const;
}

/** Query-key type for batch funding. */
export type GetGaslessBatchFundingQueryKey = ReturnType<typeof getGaslessBatchFundingQueryKey>;

/** Required action inputs plus optional query overrides. */
export type GetGaslessBatchFundingOptions = Compute<
  GetGaslessBatchFundingParameters &
    QueryParameter<GetGaslessBatchFundingData, Error, GetGaslessBatchFundingData, GetGaslessBatchFundingQueryKey>
>;

/** TanStack Query options for a batch-funding preview. */
export type GetGaslessBatchFundingQueryOptions = SymmioQueryOptions<
  GetGaslessBatchFundingData,
  Error,
  GetGaslessBatchFundingData,
  GetGaslessBatchFundingQueryKey
>;

/**
 * Build query options for a read-only funding preview. Read the core action fresh before submission.
 * @param config - SDK config.
 * @param options - Required funding inputs and query overrides.
 * @returns Options for a TanStack query, stale immediately by default.
 * @example
 * ```ts
 * const options = getGaslessBatchFundingQueryOptions(config, { account, calls, balanceChanges });
 * const preview = await queryClient.fetchQuery(options);
 * ```
 */
export function getGaslessBatchFundingQueryOptions(
  config: Config,
  options: GetGaslessBatchFundingOptions,
): GetGaslessBatchFundingQueryOptions {
  return {
    staleTime: 0,
    ...options.query,
    queryKey: getGaslessBatchFundingQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getGaslessBatchFunding(config, options),
  };
}
