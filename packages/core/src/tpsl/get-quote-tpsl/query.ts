import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getQuoteTpSl, type GetQuoteTpSlParameters, type GetQuoteTpSlReturnType } from "./get-quote-tpsl";

export type GetQuoteTpSlData = GetQuoteTpSlReturnType;

export function getQuoteTpSlQueryKey(options: Compute<GetQuoteTpSlParameters & ConfigKeyParameter>) {
  return ["getQuoteTpSl", { ...filterQueryOptions(options), quoteId: options.quoteId.toString() }] as const;
}

export type GetQuoteTpSlQueryKey = ReturnType<typeof getQuoteTpSlQueryKey>;

export type GetQuoteTpSlOptions = Compute<
  GetQuoteTpSlParameters & QueryParameter<GetQuoteTpSlData, Error, GetQuoteTpSlData, GetQuoteTpSlQueryKey>
>;

export type GetQuoteTpSlQueryOptions = SymmioQueryOptions<
  GetQuoteTpSlData,
  Error,
  GetQuoteTpSlData,
  GetQuoteTpSlQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuoteTpSl}. Disabled until
 * `quoteId` is non-zero.
 */
export function getQuoteTpSlQueryOptions(config: Config, options: GetQuoteTpSlOptions): GetQuoteTpSlQueryOptions {
  return {
    ...options.query,
    queryKey: getQuoteTpSlQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && options.quoteId > 0n,
    queryFn: () => getQuoteTpSl(config, { chainId: options.chainId, quoteId: options.quoteId }),
  };
}
