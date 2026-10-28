import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  checkListingTokenSupport,
  type CheckListingTokenSupportParameters,
  type CheckListingTokenSupportReturnType,
} from "./check-listing-token-support";

/** Query options for {@link checkListingTokenSupport}. */
export type CheckListingTokenSupportOptions = CheckListingTokenSupportParameters &
  QueryParameter<CheckListingTokenSupportReturnType>;
/** Stable cache identity, including deployment configuration. */
export function checkListingTokenSupportQueryKey(options: CheckListingTokenSupportParameters & ConfigKeyParameter) {
  return ["checkListingTokenSupport", filterQueryOptions({ ...options })] as const;
}
/** Build options for the listing read. Required identity/auth inputs gate execution. */
export function checkListingTokenSupportQueryOptions(
  config: Config,
  options: CheckListingTokenSupportOptions,
): SymmioQueryOptions<CheckListingTokenSupportReturnType> {
  return {
    ...options.query,
    queryKey: checkListingTokenSupportQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && !!options.tokenContractAddress && !!options.accessToken,
    queryFn: () => checkListingTokenSupport(config, options),
  };
}
