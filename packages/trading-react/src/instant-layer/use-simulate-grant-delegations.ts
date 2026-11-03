"use client";

import {
  simulateGrantDelegationsMutationOptions,
  type ConfigParameter,
  type SimulateGrantDelegationsParameters,
  type SimulateGrantDelegationsReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateGrantDelegations}: an optional `config`
 * override. The dry-run's inputs are passed as the mutation `variables`.
 */
export type UseSimulateGrantDelegationsParameters = ConfigParameter;

/** Return type of {@link useSimulateGrantDelegations}. */
export type UseSimulateGrantDelegationsReturnType = UseMutationResult<
  SimulateGrantDelegationsReturnType,
  SymmioRequestError,
  SimulateGrantDelegationsParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `grantDelegations`. Call
 * `mutate(args)` to run it; `data` holds viem's `{ request, result }` (a would-be
 * revert surfaces as a normalized {@link SymmioRequestError}). `from` defaults to
 * the connected wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateGrantDelegations();
 * sim.mutate({ account, delegations });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateGrantDelegations(
  parameters: UseSimulateGrantDelegationsParameters = {},
): UseSimulateGrantDelegationsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateGrantDelegationsMutationOptions(config);

  return useMutation<SimulateGrantDelegationsReturnType, SymmioRequestError, SimulateGrantDelegationsParameters>({
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
