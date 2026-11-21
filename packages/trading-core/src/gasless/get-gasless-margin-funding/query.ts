import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { getGaslessBatchFeeQuoteQueryKey } from "../get-gasless-batch-fee-quote";
import { getGaslessMarginFunding } from "./get-gasless-margin-funding";
import type { GetGaslessMarginFundingParameters, GetGaslessMarginFundingReturnType } from "./types";

/** Data resolved by the margin-funding query. */
export type GetGaslessMarginFundingData = GetGaslessMarginFundingReturnType;

/**
 * Key a preview by config, chain, relay account, encoded calls and all margin inputs.
 * @param options - Partial funding inputs and optional config identity.
 * @returns Stable query key; unencodable calls are deferred to the query function.
 */
export function getGaslessMarginFundingQueryKey(
  options: Compute<ExactPartial<GetGaslessMarginFundingParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessMarginFunding", getGaslessBatchFeeQuoteQueryKey(options)[1]] as const;
}

/** Query-key type for margin funding. */
export type GetGaslessMarginFundingQueryKey = ReturnType<typeof getGaslessMarginFundingQueryKey>;

/** Required action inputs plus optional query overrides. */
export type GetGaslessMarginFundingOptions = Compute<
  GetGaslessMarginFundingParameters &
    QueryParameter<GetGaslessMarginFundingData, Error, GetGaslessMarginFundingData, GetGaslessMarginFundingQueryKey>
>;

/** TanStack Query options for a margin-funding preview. */
export type GetGaslessMarginFundingQueryOptions = SymmioQueryOptions<
  GetGaslessMarginFundingData,
  Error,
  GetGaslessMarginFundingData,
  GetGaslessMarginFundingQueryKey
>;

/**
 * Build query options for a margin funding preview, not an execution authorization.
 * @param config - SDK config.
 * @param options - Exact batch, matching margin context and query overrides.
 * @returns Options for a TanStack query, stale immediately by default.
 * @example
 * ```ts
 * const options = getGaslessMarginFundingQueryOptions(config, parameters);
 * const preview = await queryClient.fetchQuery(options);
 * ```
 */
export function getGaslessMarginFundingQueryOptions(
  config: Config,
  options: GetGaslessMarginFundingOptions,
): GetGaslessMarginFundingQueryOptions {
  return {
    staleTime: 0,
    ...options.query,
    queryKey: getGaslessMarginFundingQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getGaslessMarginFunding(config, options),
  };
}
