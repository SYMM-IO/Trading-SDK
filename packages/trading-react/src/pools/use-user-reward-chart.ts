"use client";

import {
  getUserRewardChartQueryOptions,
  type ConfigParameter,
  type GetUserRewardChartOptions,
  type GetUserRewardChartReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useUserRewardChart}: the core query options plus an optional `config`. */
export type UseUserRewardChartParameters = GetUserRewardChartOptions & ConfigParameter;

/** Return type of {@link useUserRewardChart}: one reward series per market the user earns in. */
export type UseUserRewardChartReturnType = UseQueryResult<GetUserRewardChartReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's daily LP-reward series, grouped by market — the
 * "your performance" side of a pool page's rewards chart.
 *
 * Authed and **not** scoped to one pool: the response covers every market the
 * user has rewards in, so a single-pool view filters it by
 * `(marketAddress, marketChainId)` itself. The `accessToken` comes from
 * {@link useAuthenticateListing} and gates the query — until it is a non-empty
 * string the hook stays idle (`enabled: false`), so it can be mounted before
 * sign-in. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: charts } = useUserRewardChart({ accessToken });
 * const mine = charts?.find(
 *   (entry) => entry.marketAddress.toLowerCase() === pool.contractAddress.toLowerCase(),
 * );
 * ```
 */
export function useUserRewardChart(parameters: UseUserRewardChartParameters): UseUserRewardChartReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserRewardChartQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.accessToken.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseUserRewardChartReturnType;
}
