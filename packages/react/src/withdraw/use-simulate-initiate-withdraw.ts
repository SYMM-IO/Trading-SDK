"use client";

import {
  simulateInitiateWithdrawMutationOptions,
  type ConfigParameter,
  type SimulateInitiateWithdrawParameters,
  type SimulateInitiateWithdrawReturnType,
} from "@theoldvarorg/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateInitiateWithdraw}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateInitiateWithdrawParameters = ConfigParameter;

/** Return type of {@link useSimulateInitiateWithdraw}. */
export type UseSimulateInitiateWithdrawReturnType = UseMutationResult<
  SimulateInitiateWithdrawReturnType,
  SymmioRequestError,
  SimulateInitiateWithdrawParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of an `initiateWithdraw` transaction
 * (through the AccountLayer `_call` proxy). Call `mutate(args)` to run it; `data`
 * holds viem's `{ request, result }` (a would-be revert surfaces as a normalized
 * {@link SymmioRequestError}). `from` defaults to the connected wallet and
 * `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateInitiateWithdraw();
 * sim.mutate({ ...args });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateInitiateWithdraw(
  parameters: UseSimulateInitiateWithdrawParameters = {},
): UseSimulateInitiateWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateInitiateWithdrawMutationOptions(config);

  return useMutation<SimulateInitiateWithdrawReturnType, SymmioRequestError, SimulateInitiateWithdrawParameters>({
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
