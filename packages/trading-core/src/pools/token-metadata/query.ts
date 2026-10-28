import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingTokenMetadata,
  type GetListingTokenMetadataParameters,
  type GetListingTokenMetadataReturnType,
} from "./get-listing-token-metadata";

/** Query options for {@link getListingTokenMetadata}. */
export type GetListingTokenMetadataOptions = GetListingTokenMetadataParameters &
  QueryParameter<GetListingTokenMetadataReturnType>;
/** Stable cache identity, including deployment configuration. */
export function getListingTokenMetadataQueryKey(options: GetListingTokenMetadataParameters & ConfigKeyParameter) {
  return ["getListingTokenMetadata", filterQueryOptions({ ...options })] as const;
}
/** Build options for the listing read. Required identity/auth inputs gate execution. */
export function getListingTokenMetadataQueryOptions(
  config: Config,
  options: GetListingTokenMetadataOptions,
): SymmioQueryOptions<GetListingTokenMetadataReturnType> {
  return {
    ...options.query,
    queryKey: getListingTokenMetadataQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && !!options.tokenContractAddress && !!options.accessToken,
    queryFn: () => getListingTokenMetadata(config, options),
  };
}
