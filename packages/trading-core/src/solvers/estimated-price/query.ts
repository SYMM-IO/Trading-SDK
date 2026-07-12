import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getEstimatedPrice,
  type GetEstimatedPriceParameters,
  type GetEstimatedPriceReturnType,
} from "./get-estimated-price";

/** Data resolved by the {@link getEstimatedPriceQueryOptions} query. */
export type GetEstimatedPriceData = GetEstimatedPriceReturnType;

/** Build the TanStack Query key for {@link getEstimatedPriceQueryOptions}. */
export function getEstimatedPriceQueryKey(options: Compute<GetEstimatedPriceParameters & ConfigKeyParameter>) {
  return ["getEstimatedPrice", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEstimatedPriceQueryKey}. */
export type GetEstimatedPriceQueryKey = ReturnType<typeof getEstimatedPriceQueryKey>;

/** Options accepted by {@link getEstimatedPriceQueryOptions}. */
export type GetEstimatedPriceOptions = Compute<
  GetEstimatedPriceParameters &
    QueryParameter<GetEstimatedPriceData, Error, GetEstimatedPriceData, GetEstimatedPriceQueryKey>
>;

/** TanStack Query options returned by {@link getEstimatedPriceQueryOptions}. */
export type GetEstimatedPriceQueryOptions = SymmioQueryOptions<
  GetEstimatedPriceData,
  Error,
  GetEstimatedPriceData,
  GetEstimatedPriceQueryKey
>;

/**
 * Build TanStack Query options for {@link getEstimatedPrice}. Disabled until
 * `quantity` and `price` are non-empty, so the estimate does not fire on partial
 * input.
 *
 * @example
 * ```ts
 * useQuery(getEstimatedPriceQueryOptions(config, { symbolId, quantity, positionType, entry: "open", price }));
 * ```
 */
export function getEstimatedPriceQueryOptions(
  config: Config,
  options: GetEstimatedPriceOptions,
): GetEstimatedPriceQueryOptions {
  return {
    ...options.query,
    queryKey: getEstimatedPriceQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.quantity.length > 0 && options.price.length > 0,
    queryFn: () =>
      getEstimatedPrice(config, {
        chainId: options.chainId,
        symbolId: options.symbolId,
        quantity: options.quantity,
        positionType: options.positionType,
        entry: options.entry,
        price: options.price,
      }),
  };
}
