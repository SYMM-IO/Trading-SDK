"use client";

import {
  getGaslessDepositPolicyQueryOptions,
  type ConfigParameter,
  type GetGaslessDepositPolicyOptions,
  type GetGaslessDepositPolicyReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessDepositPolicy}. */
export type UseGaslessDepositPolicyParameters = GetGaslessDepositPolicyOptions & ConfigParameter;

/** Return type of {@link useGaslessDepositPolicy}. */
export type UseGaslessDepositPolicyReturnType = UseQueryResult<GetGaslessDepositPolicyReturnType, SymmioRequestError>;

/**
 * Read the gasless deposit policy for an owner - the deterministic deposit
 * address plus fee/minimum terms - via RPC contract reads on the GaslessLayer.
 * Gate the settlement UI on the observed balance reaching `settlementMinimum`.
 *
 * @example
 * ```tsx
 * const query = useGaslessDepositPolicy({ owner });
 * ```
 */
export function useGaslessDepositPolicy(
  parameters: UseGaslessDepositPolicyParameters,
): UseGaslessDepositPolicyReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessDepositPolicyQueryOptions(config, {
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
  }) as UseGaslessDepositPolicyReturnType;
}
