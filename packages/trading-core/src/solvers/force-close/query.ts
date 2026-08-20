import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { forceCloseAuto, type ForceCloseAutoParameters } from "./force-close-auto";
import { forceClosePosition, type ForceClosePositionParameters } from "./force-close-position";
import {
  getForceCloseParams,
  type GetForceCloseParametersParameters,
  type GetForceCloseParametersReturnType,
} from "./get-force-close-params";

/** Data resolved by {@link getForceCloseParamsQueryOptions}. */
export type GetForceCloseParamsData = GetForceCloseParametersReturnType;

/**
 * Build the TanStack Query key for {@link getForceCloseParamsQueryOptions}.
 */
export function getForceCloseParamsQueryKey(
  options: Compute<ExactPartial<GetForceCloseParametersParameters> & ConfigKeyParameter> = {},
) {
  return ["getForceCloseParams", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getForceCloseParamsQueryKey}. */
export type GetForceCloseParamsQueryKey = ReturnType<typeof getForceCloseParamsQueryKey>;

/** Options accepted by {@link getForceCloseParamsQueryOptions}. */
export type GetForceCloseParamsOptions = Compute<
  ExactPartial<GetForceCloseParametersParameters> &
    QueryParameter<GetForceCloseParamsData, Error, GetForceCloseParamsData, GetForceCloseParamsQueryKey>
>;

/** TanStack Query options returned by {@link getForceCloseParamsQueryOptions}. */
export type GetForceCloseParamsQueryOptions = SymmioQueryOptions<
  GetForceCloseParamsData,
  Error,
  GetForceCloseParamsData,
  GetForceCloseParamsQueryKey
>;

/**
 * Build TanStack Query options for {@link getForceCloseParams}. Disabled until
 * `symbolId` is set. These change rarely, so a long `staleTime` fits.
 *
 * @param config - The SDK config.
 * @param options - Query parameters (`symbolId`, chain id) and TanStack overrides.
 * @returns Options for `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getForceCloseParamsQueryOptions(config, { symbolId: 1n }));
 * ```
 */
export function getForceCloseParamsQueryOptions(
  config: Config,
  options: GetForceCloseParamsOptions = {},
): GetForceCloseParamsQueryOptions {
  return {
    ...options.query,
    queryKey: getForceCloseParamsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && options.symbolId !== undefined,
    queryFn: () => {
      if (options.symbolId === undefined) throw new Error("getForceCloseParams requires a symbolId.");
      return getForceCloseParams(config, { symbolId: options.symbolId, chainId: options.chainId });
    },
  };
}

/**
 * Build TanStack Mutation options for {@link forceCloseAuto} — the end-to-end
 * force close from a `quoteId`.
 *
 * @example
 * ```ts
 * useMutation(forceCloseAutoMutationOptions(config));
 * ```
 */
export function forceCloseAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["forceCloseAuto"] as const,
    mutationFn: (variables: ForceCloseAutoParameters) => forceCloseAuto(config, variables),
  };
}

/**
 * Build TanStack Mutation options for {@link forceClosePosition} — the single
 * write, for callers that already have the Muon sig.
 *
 * @example
 * ```ts
 * useMutation(forceClosePositionMutationOptions(config));
 * ```
 */
export function forceClosePositionMutationOptions(config: Config) {
  return {
    mutationKey: ["forceClosePosition"] as const,
    mutationFn: (variables: ForceClosePositionParameters) => forceClosePosition(config, variables),
  };
}
