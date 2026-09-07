"use client";

import {
  getOperationalFeeAllowanceQueryOptions,
  type ConfigParameter,
  type GetOperationalFeeAllowanceOptions,
  type GetOperationalFeeAllowanceReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useOperationalFeeAllowance}. */
export type UseOperationalFeeAllowanceParameters = GetOperationalFeeAllowanceOptions & ConfigParameter;

/** Return type of {@link useOperationalFeeAllowance}. */
export type UseOperationalFeeAllowanceReturnType = UseQueryResult<
  GetOperationalFeeAllowanceReturnType,
  SymmioRequestError
>;

/**
 * Read a payer's operational-fee allowance for the gasless charger from the
 * SYMMIO core diamond. Allowance reductions are delayed on-chain - surface
 * `pendingAllowance` and `reductionReadyAt` in any revoke UX.
 *
 * @example
 * ```tsx
 * const query = useOperationalFeeAllowance({ payer });
 * ```
 */
export function useOperationalFeeAllowance(
  parameters: UseOperationalFeeAllowanceParameters,
): UseOperationalFeeAllowanceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getOperationalFeeAllowanceQueryOptions(config, {
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
  }) as UseOperationalFeeAllowanceReturnType;
}
