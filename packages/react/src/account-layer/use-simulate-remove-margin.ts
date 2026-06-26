"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import {
  simulateRemoveMarginMutationOptions,
  type ConfigParameter,
  type SimulateRemoveMarginParameters,
  type SimulateRemoveMarginReturnType,
} from "@theoldvarorg/core";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSimulateRemoveMargin}: an optional `config` override.
 * The dry-run's inputs (including a `upnlSig`) are passed as the mutation
 * `variables`.
 */
export type UseSimulateRemoveMarginParameters = ConfigParameter;

/** Return type of {@link useSimulateRemoveMargin}. */
export type UseSimulateRemoveMarginReturnType = UseMutationResult<
  SimulateRemoveMarginReturnType,
  SymmioRequestError,
  SimulateRemoveMarginParameters
>;

/**
 * On-demand dry-run (`simulateContract`) of `removeMargin`. Call `mutate(args)`
 * to run it; `data` holds viem's `{ request, result }`. A would-be revert (the
 * deallocate debounce, an insolvent result, or a stale `upnlSig`) surfaces as a
 * normalized {@link SymmioRequestError}. `from` defaults to the connected wallet
 * and `chainId` to the connected chain.
 *
 * @remarks
 * The `upnlSig` is still required here — fetch it (e.g. with `useDeallocateUpnlSig`)
 * before simulating.
 *
 * @example
 * ```tsx
 * const sim = useSimulateRemoveMargin();
 * sim.mutate({ virtualAccount: "0xva…", amount: 50_000000000000000000n, upnlSig });
 * ```
 */
export function useSimulateRemoveMargin(
  parameters: UseSimulateRemoveMarginParameters = {},
): UseSimulateRemoveMarginReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const base = simulateRemoveMarginMutationOptions(config);

  return useMutation<SimulateRemoveMarginReturnType, SymmioRequestError, SimulateRemoveMarginParameters>({
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
