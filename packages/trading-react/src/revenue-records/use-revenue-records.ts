"use client";

import {
  getRevenueRecordsQueryOptions,
  type ConfigParameter,
  type GetRevenueRecordsOptions,
  type GetRevenueRecordsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useRevenueRecords}: the core query options plus an
 * optional `config`.
 */
export type UseRevenueRecordsParameters = GetRevenueRecordsOptions & ConfigParameter;

/** Return type of {@link useRevenueRecords}. */
export type UseRevenueRecordsReturnType = UseQueryResult<GetRevenueRecordsReturnType, SymmioRequestError>;

/**
 * Read incremental revenue records from the active chain's solver in one call.
 * Returns the page of normalized revenue records plus the total available
 * `count`; page through them with the `id` of the last record seen.
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 *
 * @example
 * ```tsx
 * const { data } = useRevenueRecords({ limit: 50 });
 * const nextCursor = data?.records.at(-1)?.id;
 * ```
 */
export function useRevenueRecords(parameters: UseRevenueRecordsParameters = {}): UseRevenueRecordsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getRevenueRecordsQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseRevenueRecordsReturnType;
}
