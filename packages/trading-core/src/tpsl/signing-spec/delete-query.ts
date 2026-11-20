import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getTpSlDeleteSigningSpec,
  type GetTpSlDeleteSigningSpecParameters,
  type GetTpSlDeleteSigningSpecReturnType,
} from "./get-tpsl-delete-signing-spec";

export type GetTpSlDeleteSigningSpecData = GetTpSlDeleteSigningSpecReturnType;

export function getTpSlDeleteSigningSpecQueryKey(
  options: Compute<GetTpSlDeleteSigningSpecParameters & ConfigKeyParameter>,
) {
  return ["getTpSlDeleteSigningSpec", filterQueryOptions(options)] as const;
}

export type GetTpSlDeleteSigningSpecQueryKey = ReturnType<typeof getTpSlDeleteSigningSpecQueryKey>;

export type GetTpSlDeleteSigningSpecOptions = Compute<
  GetTpSlDeleteSigningSpecParameters &
    QueryParameter<GetTpSlDeleteSigningSpecData, Error, GetTpSlDeleteSigningSpecData, GetTpSlDeleteSigningSpecQueryKey>
>;

export type GetTpSlDeleteSigningSpecQueryOptions = SymmioQueryOptions<
  GetTpSlDeleteSigningSpecData,
  Error,
  GetTpSlDeleteSigningSpecData,
  GetTpSlDeleteSigningSpecQueryKey
>;

/** Build TanStack Query options for {@link getTpSlDeleteSigningSpec}. Cache forever. */
export function getTpSlDeleteSigningSpecQueryOptions(
  config: Config,
  options: GetTpSlDeleteSigningSpecOptions = {},
): GetTpSlDeleteSigningSpecQueryOptions {
  return {
    ...options.query,
    queryKey: getTpSlDeleteSigningSpecQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getTpSlDeleteSigningSpec(config, { chainId: options.chainId }),
  };
}
