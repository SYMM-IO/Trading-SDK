"use client";

import {
  simulateApproveCollateralMutationOptions,
  type ConfigParameter,
  type SimulateApproveCollateralParameters,
  type SimulateApproveCollateralReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateApproveCollateral}: an optional `config` override. The dry-run's
 * inputs are passed as the mutation `variables`.
 */
export type UseSimulateApproveCollateralParameters = ConfigParameter;

/** Return type of {@link useSimulateApproveCollateral}. */
export type UseSimulateApproveCollateralReturnType = UseMutationResult<
  SimulateApproveCollateralReturnType,
  SymmioRequestError,
  SimulateApproveCollateralParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `approveCollateral` (the ERC20
 * `approve`). Call `mutate(args)` to run it; `data` holds viem's
 * `{ request, result }` (a would-be revert surfaces as a normalized
 * {@link SymmioRequestError}). `from` defaults to the connected wallet and
 * `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateApproveCollateral();
 * sim.mutate({ ...args });
 * // sim.data?.result, sim.isPending, sim.error
 * ```
 */
export function useSimulateApproveCollateral(
  parameters: UseSimulateApproveCollateralParameters = {},
): UseSimulateApproveCollateralReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateApproveCollateralMutationOptions(config);

  return useMutation<SimulateApproveCollateralReturnType, SymmioRequestError, SimulateApproveCollateralParameters>({
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
