"use client";

import { SymmError, type Market } from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioClient } from "../provider/use-symmio-client";
import { marketsQueryKeys } from "./query-keys";

/**
 * Parameters accepted by {@link useMarkets}.
 */
export interface UseMarketsParams {
  /**
   * Disable the query unconditionally. Use when the UI gates the fetch on
   * something other than client presence (e.g. a feature flag).
   */
  enabled?: boolean;
}

/**
 * Fetch all tradable markets (contract symbols) from the solver.
 *
 * Returns react-query's full {@link UseQueryResult} shape — `data`, `error`,
 * `isLoading`, `refetch`, etc. — so the consumer can render loading and error
 * states without learning a custom SDK shape.
 *
 * Errors are normalized to {@link SymmioRequestError} before they reach
 * react-query, so `error?.kind` is always one of the documented discriminator
 * values.
 *
 * @example
 * ```tsx
 * const { data: markets, isLoading, error } = useMarkets();
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorView kind={error.kind} message={error.message} />;
 * return <MarketList items={markets ?? []} />;
 * ```
 */
export function useMarkets(
  params: UseMarketsParams = {},
): UseQueryResult<Market[], SymmioRequestError> {
  const client = useSymmioClient();

  const enabled = (params.enabled ?? true) && client !== undefined;

  return useQuery<Market[], SymmioRequestError>({
    queryKey: marketsQueryKeys.getMarkets({
      chainId: client?.config.chainId ?? 0,
      solverUrl: client?.config.solver.url ?? "",
    }),
    enabled,
    queryFn: async () => {
      if (!client) {
        throw normalizeSymmError(new SymmError("No client available. Ensure SymmioProvider is mounted."));
      }

      try {
        return await client.getMarkets();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
