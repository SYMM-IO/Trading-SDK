"use client";

import {
  simulateGrantDelegationMutationOptions,
  type ConfigParameter,
  type SimulateGrantDelegationParameters,
  type SimulateGrantDelegationReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateGrantDelegation}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateGrantDelegationParameters = ConfigParameter;

/** Return type of {@link useSimulateGrantDelegation}. */
export type UseSimulateGrantDelegationReturnType = UseMutationResult<
  SimulateGrantDelegationReturnType,
  SymmioRequestError,
  SimulateGrantDelegationParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `grantDelegation`. Call
 * `mutate(args)` to run it; `data` holds viem's `{ request, result }` (a would-be
 * revert surfaces as a normalized {@link SymmioRequestError}). `from` defaults to
 * the connected wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateGrantDelegation();
 * sim.mutate({ ...args });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateGrantDelegation(
  parameters: UseSimulateGrantDelegationParameters = {},
): UseSimulateGrantDelegationReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateGrantDelegationMutationOptions(config);

  return useMutation<SimulateGrantDelegationReturnType, SymmioRequestError, SimulateGrantDelegationParameters>({
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
