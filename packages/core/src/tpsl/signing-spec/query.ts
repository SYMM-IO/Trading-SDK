import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getTpSlSigningSpec,
  type GetTpSlSigningSpecParameters,
  type GetTpSlSigningSpecReturnType,
} from "./get-tpsl-signing-spec";

export type GetTpSlSigningSpecData = GetTpSlSigningSpecReturnType;

export function getTpSlSigningSpecQueryKey(options: Compute<GetTpSlSigningSpecParameters & ConfigKeyParameter>) {
  return ["getTpSlSigningSpec", filterQueryOptions(options)] as const;
}

export type GetTpSlSigningSpecQueryKey = ReturnType<typeof getTpSlSigningSpecQueryKey>;

export type GetTpSlSigningSpecOptions = Compute<
  GetTpSlSigningSpecParameters &
    QueryParameter<GetTpSlSigningSpecData, Error, GetTpSlSigningSpecData, GetTpSlSigningSpecQueryKey>
>;

export type GetTpSlSigningSpecQueryOptions = SymmioQueryOptions<
  GetTpSlSigningSpecData,
  Error,
  GetTpSlSigningSpecData,
  GetTpSlSigningSpecQueryKey
>;

/** Build TanStack Query options for {@link getTpSlSigningSpec}. Cache forever. */
export function getTpSlSigningSpecQueryOptions(
  config: Config,
  options: GetTpSlSigningSpecOptions = {},
): GetTpSlSigningSpecQueryOptions {
  return {
    ...options.query,
    queryKey: getTpSlSigningSpecQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getTpSlSigningSpec(config, { chainId: options.chainId }),
  };
}
