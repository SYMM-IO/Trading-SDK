"use client";

import {
  simulateDeleteSubAccountMutationOptions,
  type ConfigParameter,
  type SimulateDeleteSubAccountParameters,
  type SimulateDeleteSubAccountReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateDeleteSubAccount}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateDeleteSubAccountParameters = ConfigParameter;

/** Return type of {@link useSimulateDeleteSubAccount}. */
export type UseSimulateDeleteSubAccountReturnType = UseMutationResult<
  SimulateDeleteSubAccountReturnType,
  SymmioRequestError,
  SimulateDeleteSubAccountParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `deleteSubAccount`. Call `mutate(args)`
 * to run it; `data` holds viem's `{ request, result }` (a would-be revert surfaces
 * as a normalized {@link SymmioRequestError}). `from` defaults to the connected
 * wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateDeleteSubAccount();
 * sim.mutate({ subAccount: "0xsub…" });
 * // sim.isSuccess, sim.isPending, sim.error
 * ```
 */
export function useSimulateDeleteSubAccount(
  parameters: UseSimulateDeleteSubAccountParameters = {},
): UseSimulateDeleteSubAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateDeleteSubAccountMutationOptions(config);

  return useMutation<SimulateDeleteSubAccountReturnType, SymmioRequestError, SimulateDeleteSubAccountParameters>({
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
