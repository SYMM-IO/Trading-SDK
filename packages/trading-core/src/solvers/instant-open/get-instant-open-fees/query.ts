import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getInstantOpenFees,
  type GetInstantOpenFeesParameters,
  type GetInstantOpenFeesReturnType,
} from "./get-instant-open-fees";

/** Data resolved by the {@link getInstantOpenFeesQueryOptions} query. */
export type GetInstantOpenFeesData = GetInstantOpenFeesReturnType;

/** Build the TanStack Query key for {@link getInstantOpenFeesQueryOptions}. */
export function getInstantOpenFeesQueryKey(options: Compute<GetInstantOpenFeesParameters & ConfigKeyParameter>) {
  return ["getInstantOpenFees", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInstantOpenFeesQueryKey}. */
export type GetInstantOpenFeesQueryKey = ReturnType<typeof getInstantOpenFeesQueryKey>;

/** Options accepted by {@link getInstantOpenFeesQueryOptions}. */
export type GetInstantOpenFeesOptions = Compute<
  GetInstantOpenFeesParameters &
    QueryParameter<GetInstantOpenFeesData, Error, GetInstantOpenFeesData, GetInstantOpenFeesQueryKey>
>;

/** TanStack Query options returned by {@link getInstantOpenFeesQueryOptions}. */
export type GetInstantOpenFeesQueryOptions = SymmioQueryOptions<
  GetInstantOpenFeesData,
  Error,
  GetInstantOpenFeesData,
  GetInstantOpenFeesQueryKey
>;

/**
 * Build TanStack Query options for {@link getInstantOpenFees}. Disabled until
 * `initialMargin` is non-empty, so the fee preview does not fire on an empty
 * amount input.
 *
 * @example
 * ```ts
 * useQuery(
 *   getInstantOpenFeesQueryOptions(config, {
 *     subAccountAddress,
 *     market: { id: 1 },
 *     positionType,
 *     initialMargin,
 *     leverage: 5,
 *   }),
 * );
 * ```
 */
export function getInstantOpenFeesQueryOptions(
  config: Config,
  options: GetInstantOpenFeesOptions,
): GetInstantOpenFeesQueryOptions {
  return {
    ...options.query,
    queryKey: getInstantOpenFeesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.initialMargin.length > 0,
    queryFn: () =>
      getInstantOpenFees(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        subAccountAddress: options.subAccountAddress,
        market: options.market,
        positionType: options.positionType,
        initialMargin: options.initialMargin,
        leverage: options.leverage,
        slippage: options.slippage,
        markPrice: options.markPrice,
        feeRates: options.feeRates,
        estimatedOpenPrice: options.estimatedOpenPrice,
      }),
  };
}
