"use client";

import {
  simulateDepositForAccountMutationOptions,
  type ConfigParameter,
  type SimulateDepositForAccountParameters,
  type SimulateDepositForAccountReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateDeposit}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateDepositParameters = ConfigParameter;

/** Return type of {@link useSimulateDeposit}. */
export type UseSimulateDepositReturnType = UseMutationResult<
  SimulateDepositForAccountReturnType,
  SymmioRequestError,
  SimulateDepositForAccountParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `depositForAccount`. Call
 * `mutate(args)` to run it; `data` holds viem's `{ request, result }` (a would-be
 * revert surfaces as a normalized {@link SymmioRequestError}). `from` defaults to
 * the connected wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateDeposit();
 * sim.mutate({ ...args });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateDeposit(parameters: UseSimulateDepositParameters = {}): UseSimulateDepositReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateDepositForAccountMutationOptions(config);

  return useMutation<SimulateDepositForAccountReturnType, SymmioRequestError, SimulateDepositForAccountParameters>({
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
