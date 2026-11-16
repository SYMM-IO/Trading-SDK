import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import type { GetLegacyCollateralLockedParameters } from "../types";
import { getLegacyCollateralLocked } from "./get-legacy-collateral-locked";

/** Data returned by {@link getLegacyCollateralLockedQueryOptions}. */
export type GetLegacyCollateralLockedData = string;
/**
 * Identify legacy data without storing bearer credentials in cache keys.
 * @param options - Account, solver and deployment identity.
 * @returns Stable TanStack Query key.
 */
export function getLegacyCollateralLockedQueryKey(
  options: Compute<Omit<GetLegacyCollateralLockedParameters, "accessToken" | "signal"> & ConfigKeyParameter>,
) {
  return ["getLegacyCollateralLocked", filterQueryOptions(options)] as const;
}
/** Cache-key type for {@link getLegacyCollateralLockedQueryOptions}. */
export type GetLegacyCollateralLockedQueryKey = ReturnType<typeof getLegacyCollateralLockedQueryKey>;
/** Required authenticated inputs and optional TanStack controls. */
export type GetLegacyCollateralLockedOptions = Compute<
  GetLegacyCollateralLockedParameters &
    QueryParameter<
      GetLegacyCollateralLockedData,
      Error,
      GetLegacyCollateralLockedData,
      GetLegacyCollateralLockedQueryKey
    >
>;
/** Options returned by {@link getLegacyCollateralLockedQueryOptions}. */
export type GetLegacyCollateralLockedQueryOptions = SymmioQueryOptions<
  GetLegacyCollateralLockedData,
  Error,
  GetLegacyCollateralLockedData,
  GetLegacyCollateralLockedQueryKey
>;

/**
 * Read exact legacy locked collateral; empty accounts or credentials keep automatic reads disabled.
 * @param config - Selected SDK deployment.
 * @param options - Authenticated account inputs and optional query controls.
 * @returns Query options with account/deployment identity and request cancellation.
 * @example const options = getLegacyCollateralLockedQueryOptions(config, { account, accessToken });
 */
export function getLegacyCollateralLockedQueryOptions(
  config: Config,
  options: GetLegacyCollateralLockedOptions,
): GetLegacyCollateralLockedQueryOptions {
  return {
    ...options.query,
    queryKey: getLegacyCollateralLockedQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.account && options.accessToken) && (options.query?.enabled ?? true),
    queryFn: (context) => getLegacyCollateralLocked(config, { ...options, signal: options.signal ?? context?.signal }),
  };
}
