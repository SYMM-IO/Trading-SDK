"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import {
  simulateFinalizeWithdrawRequestMutationOptions,
  type ConfigParameter,
  type SimulateFinalizeWithdrawRequestParameters,
  type SimulateFinalizeWithdrawRequestReturnType,
} from "@theoldvarorg/core";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateFinalizeWithdrawRequest}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateFinalizeWithdrawRequestParameters = ConfigParameter;

/** Return type of {@link useSimulateFinalizeWithdrawRequest}. */
export type UseSimulateFinalizeWithdrawRequestReturnType = UseMutationResult<
  SimulateFinalizeWithdrawRequestReturnType,
  SymmioRequestError,
  SimulateFinalizeWithdrawRequestParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `finalizeWithdrawRequest`. Call
 * `mutate(args)` to run it; `data` holds viem's `{ request, result }` (a would-be
 * revert surfaces as a normalized {@link SymmioRequestError}). `from` defaults to
 * the connected wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateFinalizeWithdrawRequest();
 * sim.mutate({ ...args });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateFinalizeWithdrawRequest(
  parameters: UseSimulateFinalizeWithdrawRequestParameters = {},
): UseSimulateFinalizeWithdrawRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateFinalizeWithdrawRequestMutationOptions(config);

  return useMutation<
    SimulateFinalizeWithdrawRequestReturnType,
    SymmioRequestError,
    SimulateFinalizeWithdrawRequestParameters
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
