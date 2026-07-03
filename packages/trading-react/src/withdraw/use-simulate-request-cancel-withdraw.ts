"use client";

import {
  simulateRequestCancelWithdrawMutationOptions,
  type ConfigParameter,
  type SimulateRequestCancelWithdrawParameters,
  type SimulateRequestCancelWithdrawReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateRequestCancelWithdraw}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateRequestCancelWithdrawParameters = ConfigParameter;

/** Return type of {@link useSimulateRequestCancelWithdraw}. */
export type UseSimulateRequestCancelWithdrawReturnType = UseMutationResult<
  SimulateRequestCancelWithdrawReturnType,
  SymmioRequestError,
  SimulateRequestCancelWithdrawParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `requestCancelWithdraw`. Call
 * `mutate(args)` to run it; `data` holds viem's `{ request, result }` (a would-be
 * revert surfaces as a normalized {@link SymmioRequestError}). `from` defaults to
 * the connected wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateRequestCancelWithdraw();
 * sim.mutate({ ...args });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateRequestCancelWithdraw(
  parameters: UseSimulateRequestCancelWithdrawParameters = {},
): UseSimulateRequestCancelWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateRequestCancelWithdrawMutationOptions(config);

  return useMutation<
    SimulateRequestCancelWithdrawReturnType,
    SymmioRequestError,
    SimulateRequestCancelWithdrawParameters
  >({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({
          ...variables,
          chainId: variables.chainId ?? chainId,
          from: variables.from ?? address,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
