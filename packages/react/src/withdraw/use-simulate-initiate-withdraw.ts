"use client";

import {
  getSimulateInitiateWithdrawQueryOptions,
  type ConfigParameter,
  type SimulateInitiateWithdrawData,
  type SimulateInitiateWithdrawOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateInitiateWithdraw}: the core simulate options
 * (account, parts, speedUp, providerData, from, chain id, TanStack `query`
 * overrides) plus an optional `config`.
 */
export type UseSimulateInitiateWithdrawParameters = SimulateInitiateWithdrawOptions & ConfigParameter;

/** Return type of {@link useSimulateInitiateWithdraw}. */
export type UseSimulateInitiateWithdrawReturnType = UseQueryResult<SimulateInitiateWithdrawData, SymmioRequestError>;

/**
 * Dry-run an `initiateWithdraw` transaction (`simulateContract` through the
 * AccountLayer `_call` proxy) without sending it. Disabled until `account` and a
 * non-empty `parts` are set; `from` defaults to the connected wallet. A would-be
 * revert surfaces as a normalized {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateInitiateWithdraw({ account, parts, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateInitiateWithdraw(
  parameters: UseSimulateInitiateWithdrawParameters = {},
): UseSimulateInitiateWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateInitiateWithdrawQueryOptions(config, {
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
  }) as UseSimulateInitiateWithdrawReturnType;
}
