"use client";

import {
  getSimulateDepositAndAllocateForAccountQueryOptions,
  type ConfigParameter,
  type SimulateDepositAndAllocateForAccountData,
  type SimulateDepositAndAllocateForAccountOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateDepositAndAllocate}: the core simulate options
 * (account, amount, from, chain id, TanStack `query` overrides) plus an optional
 * `config`.
 */
export type UseSimulateDepositAndAllocateParameters = SimulateDepositAndAllocateForAccountOptions & ConfigParameter;

/** Return type of {@link useSimulateDepositAndAllocate}. */
export type UseSimulateDepositAndAllocateReturnType = UseQueryResult<
  SimulateDepositAndAllocateForAccountData,
  SymmioRequestError
>;

/**
 * Dry-run a `depositAndAllocateForAccount` transaction (`simulateContract`)
 * without sending it. Disabled until `account` and `amount` are set; `from`
 * defaults to the connected wallet. A would-be revert surfaces as a normalized
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateDepositAndAllocate({ account, amount, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateDepositAndAllocate(
  parameters: UseSimulateDepositAndAllocateParameters = {},
): UseSimulateDepositAndAllocateReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateDepositAndAllocateForAccountQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    from: parameters.from ?? address,
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
  }) as UseSimulateDepositAndAllocateReturnType;
}
