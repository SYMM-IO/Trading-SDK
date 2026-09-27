import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getInstantCloseFees,
  type GetInstantCloseFeesParameters,
  type GetInstantCloseFeesReturnType,
} from "./get-instant-close-fees";

/** Data resolved by the {@link getInstantCloseFeesQueryOptions} query. */
export type GetInstantCloseFeesData = GetInstantCloseFeesReturnType;

/** Build the TanStack Query key for {@link getInstantCloseFeesQueryOptions}. */
export function getInstantCloseFeesQueryKey(options: Compute<GetInstantCloseFeesParameters & ConfigKeyParameter>) {
  return ["getInstantCloseFees", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInstantCloseFeesQueryKey}. */
export type GetInstantCloseFeesQueryKey = ReturnType<typeof getInstantCloseFeesQueryKey>;

/** Options accepted by {@link getInstantCloseFeesQueryOptions}. */
export type GetInstantCloseFeesOptions = Compute<
  GetInstantCloseFeesParameters &
    QueryParameter<GetInstantCloseFeesData, Error, GetInstantCloseFeesData, GetInstantCloseFeesQueryKey>
>;

/** TanStack Query options returned by {@link getInstantCloseFeesQueryOptions}. */
export type GetInstantCloseFeesQueryOptions = SymmioQueryOptions<
  GetInstantCloseFeesData,
  Error,
  GetInstantCloseFeesData,
  GetInstantCloseFeesQueryKey
>;

/**
 * Build TanStack Query options for {@link getInstantCloseFees}. Disabled until
 * a non-empty `quantity` exists, so the close-fee preview does not fire on an
 * empty amount input.
 *
 * The holding time is stamped when the query function runs (each fetch /
 * refetch re-reads the clock), so a refetch after the position ages re-prices
 * the decaying solver close fee.
 *
 * @example
 * ```ts
 * useQuery(
 *   getInstantCloseFeesQueryOptions(config, {
 *     subAccountAddress,
 *     market: { id: 1 },
 *     quantity: "2.5",
 *     openedAt: position.createTimestamp,
 *   }),
 * );
 * ```
 */
export function getInstantCloseFeesQueryOptions(
  config: Config,
  options: GetInstantCloseFeesOptions,
): GetInstantCloseFeesQueryOptions {
  return {
    ...options.query,
    queryKey: getInstantCloseFeesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.quantity.length > 0,
    queryFn: () =>
      getInstantCloseFees(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        subAccountAddress: options.subAccountAddress,
        market: options.market,
        quantity: options.quantity,
        openedAt: options.openedAt,
        now: options.now,
        markPrice: options.markPrice,
        feeRates: options.feeRates,
        solverInfo: options.solverInfo,
      }),
  };
}
