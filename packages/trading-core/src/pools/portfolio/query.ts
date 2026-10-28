import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolPortfolio,
  type GetPoolPortfolioParameters,
  type GetPoolPortfolioReturnType,
} from "./get-pool-portfolio";
/** Stable key for the composed core read. Credentials are excluded. */
export function getPoolPortfolioQueryKey(options: Compute<GetPoolPortfolioParameters & ConfigKeyParameter>) {
  return ["getPoolPortfolio", filterQueryOptions(options)] as const;
}
/** Composed query key type. */
export type GetPoolPortfolioQueryKey = ReturnType<typeof getPoolPortfolioQueryKey>;
/** Query controls plus all required read inputs. */
export type GetPoolPortfolioOptions = GetPoolPortfolioParameters &
  QueryParameter<GetPoolPortfolioReturnType, Error, GetPoolPortfolioReturnType, GetPoolPortfolioQueryKey>;
/** Build options for non-React consumers; React composition uses the underlying primitive queries instead.
 * @param config - SDK configuration.
 * @param options - Required read inputs and optional query controls.
 * @returns Typed query options with a credential-free key.
 */
export function getPoolPortfolioQueryOptions(
  config: Config,
  options: GetPoolPortfolioOptions,
): SymmioQueryOptions<GetPoolPortfolioReturnType, Error, GetPoolPortfolioReturnType, GetPoolPortfolioQueryKey> {
  return {
    ...options.query,
    queryKey: getPoolPortfolioQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && options.accessToken.length > 0 && options.userAddress.length > 0,
    queryFn: () => getPoolPortfolio(config, options),
  };
}
