import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPredictedNextVirtualAccount,
  type GetPredictedNextVirtualAccountParameters,
  type GetPredictedNextVirtualAccountReturnType,
} from "../actions/predict-next-virtual-account";

/** Data resolved by the {@link getPredictedNextVirtualAccountQueryOptions} query. */
export type GetPredictedNextVirtualAccountData = GetPredictedNextVirtualAccountReturnType;

/**
 * Default cache window for {@link getPredictedNextVirtualAccountQueryOptions}. The
 * predicted address is stable per `(subAccount, isolationType, symbolId)` only
 * until the subaccount's virtual nonce advances, so a short stale window keeps
 * the result fresh without refetching on every render. Override via
 * `query.staleTime`.
 */
const DEFAULT_STALE_TIME_MS = 10_000;

/**
 * Build the TanStack Query key for {@link getPredictedNextVirtualAccountQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, subAccount, isolationType, symbolId).
 * @returns A stable, hashable query key.
 */
export function getPredictedNextVirtualAccountQueryKey(
  options: Compute<ExactPartial<GetPredictedNextVirtualAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["getPredictedNextVirtualAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPredictedNextVirtualAccountQueryKey}. */
export type GetPredictedNextVirtualAccountQueryKey = ReturnType<typeof getPredictedNextVirtualAccountQueryKey>;

/**
 * Options accepted by {@link getPredictedNextVirtualAccountQueryOptions}: the
 * action's parameters (all optional), an optional cache scope, and TanStack
 * overrides.
 */
export type GetPredictedNextVirtualAccountOptions = Compute<
  ExactPartial<GetPredictedNextVirtualAccountParameters> &
    QueryParameter<
      GetPredictedNextVirtualAccountData,
      Error,
      GetPredictedNextVirtualAccountData,
      GetPredictedNextVirtualAccountQueryKey
    >
>;

/** TanStack Query options returned by {@link getPredictedNextVirtualAccountQueryOptions}. */
export type GetPredictedNextVirtualAccountQueryOptions = SymmioQueryOptions<
  GetPredictedNextVirtualAccountData,
  Error,
  GetPredictedNextVirtualAccountData,
  GetPredictedNextVirtualAccountQueryKey
>;

/**
 * Build TanStack Query options for {@link getPredictedNextVirtualAccount}. The
 * query is disabled until `subAccount`, `isolationType`, and `symbolId` are all
 * set. An unsupported chain surfaces a {@link SymmError} from the query function
 * (it is not silently disabled).
 *
 * The predicted address is stable per `(subAccount, isolationType, symbolId)`
 * until the subaccount's virtual nonce advances, so a short default
 * `staleTime` is applied; override it via `query.staleTime`.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getPredictedNextVirtualAccountQueryOptions(config, {
 *     subAccount,
 *     isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
 *     symbolId: 1n,
 *   }),
 * );
 * ```
 */
export function getPredictedNextVirtualAccountQueryOptions(
  config: Config,
  options: GetPredictedNextVirtualAccountOptions = {},
): GetPredictedNextVirtualAccountQueryOptions {
  return {
    staleTime: DEFAULT_STALE_TIME_MS,
    ...options.query,
    queryKey: getPredictedNextVirtualAccountQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled:
      Boolean(options.subAccount) &&
      options.isolationType !== undefined &&
      options.symbolId !== undefined &&
      (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, subAccount, isolationType, symbolId } = options;
      if (!subAccount || isolationType === undefined || symbolId === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_PREDICT_VA_INPUTS",
          "getPredictedNextVirtualAccount: `subAccount`, `isolationType`, and `symbolId` are required.",
        );
      }
      return getPredictedNextVirtualAccount(config, { chainId, subAccount, isolationType, symbolId });
    },
  };
}
