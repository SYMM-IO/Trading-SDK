"use client";

import {
  getGaslessMarginFundingQueryOptions,
  type ConfigParameter,
  type GetGaslessMarginFundingOptions,
  type GetGaslessMarginFundingReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Required margin funding inputs, query overrides and optional SDK config. */
export type UseGaslessMarginFundingParameters = GetGaslessMarginFundingOptions & ConfigParameter;
/** Query result for an advisory margin-funding preview. */
export type UseGaslessMarginFundingReturnType = UseQueryResult<GetGaslessMarginFundingReturnType, SymmioRequestError>;

/**
 * Read margin fee coverage and an applicable fee-safe add bound from core.
 * This hook owns only query lifecycle, chain/config selection and error
 * normalization. It does not adjust amounts, sign or submit. Use `query.enabled`
 * for form readiness and `refetch` for a fresh preview; cached results must not
 * authorize a new operation. Pending-operation recovery and user choices remain
 * consumer-owned. There is no automatic polling or transaction side effect.
 * @param parameters - Exact batch and matching margin context, optional chain/config and query overrides.
 * @returns Funding data, loading/refetch state and normalized SDK errors.
 * @example
 * ```tsx
 * const funding = useGaslessMarginFunding({
 *   account: parentAccount, parentAccount, virtualAccount, direction: "add", amount18,
 *   calls: [{ functionName: "addMargin", args: [virtualAccount, amount18] }],
 * });
 * ```
 */
export function useGaslessMarginFunding(
  parameters: UseGaslessMarginFundingParameters,
): UseGaslessMarginFundingReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getGaslessMarginFundingQueryOptions(config, {
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
  }) as UseGaslessMarginFundingReturnType;
}
