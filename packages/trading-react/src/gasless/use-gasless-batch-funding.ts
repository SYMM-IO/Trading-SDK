"use client";

import {
  getGaslessBatchFundingQueryOptions,
  type ConfigParameter,
  type GetGaslessBatchFundingOptions,
  type GetGaslessBatchFundingReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Required funding inputs, query overrides and optional SDK config. */
export type UseGaslessBatchFundingParameters = GetGaslessBatchFundingOptions & ConfigParameter;
/** Query result for an advisory batch-funding preview. */
export type UseGaslessBatchFundingReturnType = UseQueryResult<GetGaslessBatchFundingReturnType, SymmioRequestError>;

/**
 * Read per-payer projected fee coverage through the core funding action.
 * All calculations stay in core. Input changes select a different query; reads
 * are stale immediately by default. Use `query.enabled` to control form reads,
 * and `refetch` to refresh a displayed preview. Cached data is not permission
 * to submit: check funding fresh after pending-operation reconciliation.
 * @param parameters - Exact batch, balance movements, optional chain/config and query overrides.
 * @returns Funding data, loading/refetch state and normalized SDK errors.
 * @example
 * ```tsx
 * const funding = useGaslessBatchFunding({ account, calls, balanceChanges });
 * ```
 */
export function useGaslessBatchFunding(parameters: UseGaslessBatchFundingParameters): UseGaslessBatchFundingReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getGaslessBatchFundingQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseGaslessBatchFundingReturnType;
}
