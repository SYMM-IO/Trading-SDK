"use client";

import {
  simulateAddMarginMutationOptions,
  type ConfigParameter,
  type SimulateAddMarginParameters,
  type SimulateAddMarginReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateAddMargin}: an optional `config` override. The
 * dry-run's inputs are passed as the mutation `variables`.
 */
export type UseSimulateAddMarginParameters = ConfigParameter;

/** Return type of {@link useSimulateAddMargin}. */
export type UseSimulateAddMarginReturnType = UseMutationResult<
  SimulateAddMarginReturnType,
  SymmioRequestError,
  SimulateAddMarginParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `addMargin`. Call `mutate(args)` to
 * run it; `data` holds viem's `{ request, result }` (a would-be revert surfaces
 * as a normalized {@link SymmioRequestError}). `from` defaults to the connected
 * wallet and `chainId` to the connected chain.
 *
 * @example
 * ```tsx
 * const sim = useSimulateAddMargin();
 * sim.mutate({ virtualAccount: "0xva…", amount: 50_000000000000000000n });
 * ```
 */
export function useSimulateAddMargin(parameters: UseSimulateAddMarginParameters = {}): UseSimulateAddMarginReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateAddMarginMutationOptions(config);

  return useMutation<SimulateAddMarginReturnType, SymmioRequestError, SimulateAddMarginParameters>({
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
