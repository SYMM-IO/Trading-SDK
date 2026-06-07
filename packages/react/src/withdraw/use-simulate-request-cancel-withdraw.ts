"use client";

import {
  getSimulateRequestCancelWithdrawQueryOptions,
  type ConfigParameter,
  type SimulateRequestCancelWithdrawData,
  type SimulateRequestCancelWithdrawOptions,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateRequestCancelWithdraw}: the core simulate
 * options (account, requestId, from, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseSimulateRequestCancelWithdrawParameters = SimulateRequestCancelWithdrawOptions & ConfigParameter;

/** Return type of {@link useSimulateRequestCancelWithdraw}. */
export type UseSimulateRequestCancelWithdrawReturnType = UseQueryResult<
  SimulateRequestCancelWithdrawData,
  SymmioRequestError
>;

/**
 * Dry-run a `requestCancelWithdraw` transaction (`simulateContract` through the
 * AccountLayer `_call` proxy) without sending it. Disabled until `account` and
 * `requestId` are set; `from` defaults to the connected wallet. A would-be revert
 * surfaces as a normalized {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const sim = useSimulateRequestCancelWithdraw({ account, requestId, query: { enabled: false } });
 * sim.refetch();
 * ```
 */
export function useSimulateRequestCancelWithdraw(
  parameters: UseSimulateRequestCancelWithdrawParameters = {},
): UseSimulateRequestCancelWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const options = getSimulateRequestCancelWithdrawQueryOptions(config, {
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
  }) as UseSimulateRequestCancelWithdrawReturnType;
}
