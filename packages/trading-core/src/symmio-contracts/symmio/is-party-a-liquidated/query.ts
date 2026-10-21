import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  isPartyALiquidated,
  type IsPartyALiquidatedParameters,
  type IsPartyALiquidatedReturnType,
} from "./is-party-a-liquidated";

/** Data resolved by the {@link isPartyALiquidatedQueryOptions} query. */
export type IsPartyALiquidatedData = IsPartyALiquidatedReturnType;

/**
 * Build the TanStack Query key for {@link isPartyALiquidatedQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, partyA).
 * @returns A stable, hashable query key.
 */
export function isPartyALiquidatedQueryKey(
  options: Compute<ExactPartial<IsPartyALiquidatedParameters> & ConfigKeyParameter> = {},
) {
  return ["isPartyALiquidated", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link isPartyALiquidatedQueryKey}. */
export type IsPartyALiquidatedQueryKey = ReturnType<typeof isPartyALiquidatedQueryKey>;

/**
 * Options accepted by {@link isPartyALiquidatedQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type IsPartyALiquidatedOptions = Compute<
  ExactPartial<IsPartyALiquidatedParameters> &
    QueryParameter<IsPartyALiquidatedData, Error, IsPartyALiquidatedData, IsPartyALiquidatedQueryKey>
>;

/** TanStack Query options returned by {@link isPartyALiquidatedQueryOptions}. */
export type IsPartyALiquidatedQueryOptions = SymmioQueryOptions<
  IsPartyALiquidatedData,
  Error,
  IsPartyALiquidatedData,
  IsPartyALiquidatedQueryKey
>;

/**
 * Build TanStack Query options for {@link isPartyALiquidated}. The query is
 * disabled until `partyA` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(isPartyALiquidatedQueryOptions(config, { partyA, chainId }));
 * ```
 */
export function isPartyALiquidatedQueryOptions(
  config: Config,
  options: IsPartyALiquidatedOptions = {},
): IsPartyALiquidatedQueryOptions {
  return {
    ...options.query,
    queryKey: isPartyALiquidatedQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.partyA) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, partyA } = options;
      if (!partyA) {
        throw new SymmError("validation", "MISSING_PARTY_A", "isPartyALiquidated: `partyA` is required.");
      }
      return isPartyALiquidated(config, { chainId, partyA });
    },
  };
}
