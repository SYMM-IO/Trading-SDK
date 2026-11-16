import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import type { GetLegacyOrderHistoryParameters, LegacyOrderHistoryEntry } from "../types";
import { getLegacyOrderHistory } from "./get-legacy-order-history";

/** Data returned by {@link getLegacyOrderHistoryQueryOptions}. */
export type GetLegacyOrderHistoryData = LegacyOrderHistoryEntry[];
/**
 * Identify legacy data without storing bearer credentials in cache keys.
 * @param options - Account, solver and deployment identity.
 * @returns Stable TanStack Query key.
 */
export function getLegacyOrderHistoryQueryKey(
  options: Compute<Omit<GetLegacyOrderHistoryParameters, "accessToken" | "signal"> & ConfigKeyParameter>,
) {
  return ["getLegacyOrderHistory", filterQueryOptions(options)] as const;
}
/** Cache-key type for {@link getLegacyOrderHistoryQueryOptions}. */
export type GetLegacyOrderHistoryQueryKey = ReturnType<typeof getLegacyOrderHistoryQueryKey>;
/** Required authenticated inputs and optional TanStack controls. */
export type GetLegacyOrderHistoryOptions = Compute<
  GetLegacyOrderHistoryParameters &
    QueryParameter<GetLegacyOrderHistoryData, Error, GetLegacyOrderHistoryData, GetLegacyOrderHistoryQueryKey>
>;
/** Options returned by {@link getLegacyOrderHistoryQueryOptions}. */
export type GetLegacyOrderHistoryQueryOptions = SymmioQueryOptions<
  GetLegacyOrderHistoryData,
  Error,
  GetLegacyOrderHistoryData,
  GetLegacyOrderHistoryQueryKey
>;

/**
 * Read legacy order history in server order; empty accounts or credentials keep automatic reads disabled.
 * @param config - Selected SDK deployment.
 * @param options - Authenticated account inputs and optional query controls.
 * @returns Query options with account/deployment identity and request cancellation.
 * @example const options = getLegacyOrderHistoryQueryOptions(config, { account, accessToken });
 */
export function getLegacyOrderHistoryQueryOptions(
  config: Config,
  options: GetLegacyOrderHistoryOptions,
): GetLegacyOrderHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getLegacyOrderHistoryQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.account && options.accessToken) && (options.query?.enabled ?? true),
    queryFn: (context) => getLegacyOrderHistory(config, { ...options, signal: options.signal ?? context?.signal }),
  };
}
